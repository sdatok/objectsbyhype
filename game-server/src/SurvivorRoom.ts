import { Room, Client } from "@colyseus/core";
import { SurvivorState, Player } from "./state";
import {
  TICK_MS,
  PLAYER_MAX_HP,
  MAX_PLAYERS,
  DEFAULT_LOBBY_SECONDS,
  ZONE_START_RADIUS,
  MAX_INPUTS_PER_SEC,
  PICKUP_SPAWN_INTERVAL_MS,
} from "./constants";
import { verifyMatchToken } from "./hmac";
import {
  tickPlayers,
  tickShooting,
  tickBullets,
  tickZone,
  tickPickups,
  freshPickupCtx,
  generateObstacles,
  sanitizeInput,
  emptyInput,
  emptyEvents,
  type PlayerInput,
} from "./physics";
import { postMatchResult, type ResultParticipant } from "./webhook";

/**
 * One global Colyseus room that holds the current match. The lifecycle is:
 *
 *   WAITING   ─ admin POSTs /admin/start ─▶  COUNTDOWN
 *   COUNTDOWN ─ timer (5s) ─────────────▶  PLAYING
 *   PLAYING   ─ last alive | timer hits 0 | admin /end ─▶  ENDED
 *   ENDED     ─ result posted to Next.js ─▶  WAITING (matchId cleared)
 *
 * One instance is created lazily on first connection and kept alive for the
 * server's lifetime. Joining clients that arrive while PLAYING attach as
 * spectators (Player.alive=false, can't move/shoot).
 */
export class SurvivorRoom extends Room<SurvivorState> {
  maxClients = 200; // generous; spectators can fill above MAX_PLAYERS
  // Never auto-dispose; we keep one persistent room across matches so admin
  // calls always have a target. Colyseus would otherwise drop the room as
  // soon as the lobby goes empty.
  override autoDispose = false;

  /** Latest input from each connected player. */
  private inputs = new Map<string, PlayerInput>();
  /** Track input rate per session so we can drop spammers. */
  private inputCounters = new Map<
    string,
    { windowStart: number; count: number }
  >();
  /** Set once at start, used by webhook to bind participants to the match. */
  private matchPrize = "";
  /** Wall-clock time the current match started; needed for survivedSeconds. */
  private startedAtServerMs = 0;
  /** True once we've kicked off the webhook so we don't double-post. */
  private resultPosted = false;
  /** Mutable context for pickup spawn cadence (not part of the schema). */
  private pickupCtx = freshPickupCtx();

  override onCreate() {
    const state = new SurvivorState();
    state.zone.cx = 0;
    state.zone.cy = 0;
    state.zone.radius = ZONE_START_RADIUS;
    state.zone.targetRadius = ZONE_START_RADIUS;
    state.status = "WAITING";
    this.setState(state);

    this.onMessage("input", (client, raw) => {
      if (!this.rateLimitInput(client.sessionId)) return;
      const inp = sanitizeInput(raw);
      if (!inp) return;
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      // Dead players (spectators) can't influence the world.
      if (!player.alive) return;
      this.inputs.set(client.sessionId, inp);
    });

    // Admin uses sendBypass via room.broadcast for state messages; this
    // listener exists only so a stray "ping" from clients doesn't blow up.
    this.onMessage("ping", (client) => {
      client.send("pong", { t: Date.now() });
    });

    this.setSimulationInterval((dtMs) => this.tick(dtMs), TICK_MS);
    // Send state patches every simulation tick instead of the default 50ms,
    // so the client gets a fresh snapshot pair every ~33ms and interpolation
    // looks smoother (especially noticeable on player movement).
    this.setPatchRate(TICK_MS);

    console.log("[SurvivorRoom] created");
  }

  override async onAuth(
    _client: Client,
    options: Record<string, unknown>
  ): Promise<{
    email: string;
    displayName: string;
    matchId: string;
    isSpectator: boolean;
  }> {
    const email = String(options.email ?? "").trim().toLowerCase();
    const displayName = String(options.displayName ?? "").trim().slice(0, 32);
    const matchId = String(options.matchId ?? "").trim();
    const issuedAtMs = Number(options.issuedAtMs);
    const matchToken = String(options.matchToken ?? "");

    if (!email || !displayName || !matchId || !matchToken) {
      throw new Error("Missing join credentials");
    }
    if (!Number.isFinite(issuedAtMs)) {
      throw new Error("Missing token timestamp");
    }
    if (matchId !== this.state.matchId) {
      console.warn(
        `[SurvivorRoom] reject join: client matchId=${matchId} email=${email} but room.state.matchId=${this.state.matchId || "<empty>"} status=${this.state.status}`
      );
      // Empty room.state.matchId almost always means the container restarted
      // (Railway redeploy / OOM / etc.) and lost in-memory state. The lobby
      // will display this verbatim; we phrase it so admin knows what to do.
      if (!this.state.matchId) {
        throw new Error(
          "Game server restarted — ask admin to open a new match."
        );
      }
      throw new Error("Match has moved on — refresh the lobby.");
    }
    const ok = verifyMatchToken(
      { matchId, email, displayName, issuedAtMs },
      matchToken
    );
    if (!ok) {
      throw new Error("Invalid join token");
    }
    // One live connection per email. Disconnected slots (connected=false) are
    // cleared so a fresh join works when reconnectionToken was lost (e.g. page
    // reload). Reconnecting via token skips onAuth and reuses the same seat.
    const existingEntry = Array.from(this.state.players.entries()).find(
      ([, p]) => p.email === email
    );
    if (existingEntry) {
      const [existingSessionId, existingPlayer] = existingEntry;
      if (existingPlayer.connected) {
        throw new Error("You are already in this match in another tab.");
      }
      this.state.players.delete(existingSessionId);
      this.inputs.delete(existingSessionId);
      this.inputCounters.delete(existingSessionId);
    }

    // WAITING/COUNTDOWN admit everyone as active. During PLAYING we still
    // admit active players while under the cap so a Railway restart doesn't
    // trap returning players as permanent spectators.
    const inLobby =
      this.state.status === "WAITING" || this.state.status === "COUNTDOWN";
    const alivePlayers = this.countAlive();
    const canJoinActive =
      inLobby ||
      (this.state.status === "PLAYING" && alivePlayers < MAX_PLAYERS);
    if (inLobby && alivePlayers >= MAX_PLAYERS) {
      throw new Error("Match is full (25 players).");
    }
    const isSpectator = !canJoinActive;
    return { email, displayName, matchId, isSpectator };
  }

  override onJoin(
    client: Client,
    _options: Record<string, unknown>,
    auth: {
      email: string;
      displayName: string;
      matchId: string;
      isSpectator: boolean;
    }
  ): void {
    const p = new Player();
    p.email = auth.email;
    p.displayName = auth.displayName;
    p.connected = true;

    if (auth.isSpectator) {
      // Spectator slot: dead from the jump, no spawn coords needed.
      p.alive = false;
      p.hp = 0;
      p.x = 0;
      p.y = 0;
    } else {
      const spawn = this.pickSpawn();
      p.x = spawn.x;
      p.y = spawn.y;
      p.hp = PLAYER_MAX_HP;
      p.alive = true;
    }
    this.state.players.set(client.sessionId, p);
    this.inputs.set(client.sessionId, emptyInput());
    console.log(
      `[SurvivorRoom] join ${client.sessionId} (${auth.email}) spectator=${auth.isSpectator}`
    );
  }

  /** Seconds to hold a disconnected player's seat before counting them out. */
  private static readonly RECONNECT_SECONDS = 90;

  override async onLeave(client: Client, consented: boolean): Promise<void> {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;

    const status = this.state.status;
    const canReconnect =
      !consented &&
      p.alive &&
      (status === "PLAYING" || status === "COUNTDOWN" || status === "WAITING");

    if (canReconnect) {
      p.connected = false;
      this.inputs.delete(client.sessionId);
      this.inputCounters.delete(client.sessionId);
      console.log(
        `[SurvivorRoom] disconnect ${client.sessionId}, holding seat ${SurvivorRoom.RECONNECT_SECONDS}s`
      );
      try {
        await this.allowReconnection(client, SurvivorRoom.RECONNECT_SECONDS);
        p.connected = true;
        this.inputs.set(client.sessionId, emptyInput());
        console.log(`[SurvivorRoom] reconnected ${client.sessionId}`);
      } catch {
        this.finalizeLeave(client.sessionId, p, status);
      }
      return;
    }

    this.finalizeLeave(client.sessionId, p, status);
  }

  /** Permanent leave: free lobby slots or count an in-match dropout as dead. */
  private finalizeLeave(
    sessionId: string,
    p: Player,
    status: SurvivorState["status"]
  ): void {
    p.connected = false;
    if (status === "WAITING") {
      this.state.players.delete(sessionId);
    } else if (p.alive && status === "PLAYING") {
      p.alive = false;
      p.deathAt = Date.now();
    }
    this.inputs.delete(sessionId);
    this.inputCounters.delete(sessionId);
    console.log(`[SurvivorRoom] leave ${sessionId}`);
  }

  // ---------- Match control (called from Express routes) ----------

  /**
   * Open a lobby for a new match.
   *
   * Status transitions:
   *   any -> COUNTDOWN (admit active joiners for `lobbySeconds`)
   *   COUNTDOWN -> PLAYING (auto, after lobbySeconds)
   *   PLAYING -> ENDED (timer / last alive)
   */
  startMatch(
    matchId: string,
    prizeTitle: string,
    matchSeconds: number,
    lobbySeconds: number
  ): void {
    if (
      this.state.status === "PLAYING" ||
      this.state.status === "COUNTDOWN"
    ) {
      throw new Error(
        "Match already in progress on the game server — end it before starting a new one."
      );
    }

    // Kick everyone from any previous ENDED/WAITING match before swapping matchId.
    this.resetForNewMatch(false);

    // Lay down island props on the beach (uses zone.radius for placement).
    this.state.zone.radius = ZONE_START_RADIUS;
    this.state.zone.targetRadius = ZONE_START_RADIUS;
    generateObstacles(this.state);

    const now = Date.now();
    this.state.matchId = matchId;
    this.state.prizeTitle = prizeTitle;
    this.state.status = "COUNTDOWN";
    this.state.countdownEndsAtMs = now + lobbySeconds * 1000;
    this.state.matchEndsAtMs =
      this.state.countdownEndsAtMs + matchSeconds * 1000;
    this.matchPrize = prizeTitle;

    console.log(
      `[SurvivorRoom] startMatch matchId=${matchId} lobby=${lobbySeconds}s match=${matchSeconds}s obstacles=${this.state.obstacles.length}`
    );

    this.clock.setTimeout(() => {
      this.beginPlaying();
    }, lobbySeconds * 1000);
  }

  /**
   * Re-bind an existing DB match after a process restart. Does not disconnect
   * clients (usually none are connected right after a crash). Skips the lobby
   * countdown when restoring straight into PLAYING.
   */
  restoreMatch(
    matchId: string,
    prizeTitle: string,
    matchSeconds: number,
    lobbySeconds: number,
    targetStatus: "WAITING" | "COUNTDOWN" | "PLAYING",
    startedAtMs: number,
    matchEndsAtMs: number
  ): void {
    if (
      this.state.matchId === matchId &&
      (this.state.status === "PLAYING" || this.state.status === "COUNTDOWN")
    ) {
      return;
    }

    this.resetForNewMatch(false);
    this.state.zone.radius = ZONE_START_RADIUS;
    this.state.zone.targetRadius = ZONE_START_RADIUS;
    generateObstacles(this.state);

    const now = Date.now();
    this.state.matchId = matchId;
    this.state.prizeTitle = prizeTitle;
    this.matchPrize = prizeTitle;

    if (targetStatus === "PLAYING" && startedAtMs > 0 && matchEndsAtMs > startedAtMs) {
      this.state.status = "PLAYING";
      this.state.startedAtMs = startedAtMs;
      this.startedAtServerMs = startedAtMs;
      this.state.matchEndsAtMs = matchEndsAtMs;
      this.state.countdownEndsAtMs = 0;
      this.pickupCtx = {
        nextSpawnAtMs: now + Math.floor(PICKUP_SPAWN_INTERVAL_MS * 0.6),
      };
      // Snap zone to the correct point on the shrink curve immediately.
      tickZone(this.state, 0, now, emptyEvents());
      console.log(
        `[SurvivorRoom] restoreMatch PLAYING matchId=${matchId} obstacles=${this.state.obstacles.length}`
      );
      return;
    }

    this.state.status = "COUNTDOWN";
    this.state.countdownEndsAtMs = now + lobbySeconds * 1000;
    this.state.matchEndsAtMs = this.state.countdownEndsAtMs + matchSeconds * 1000;
    this.clock.setTimeout(() => {
      this.beginPlaying();
    }, lobbySeconds * 1000);
    console.log(
      `[SurvivorRoom] restoreMatch COUNTDOWN matchId=${matchId} lobby=${lobbySeconds}s`
    );
  }

  endMatch(reason: "admin" | "lastAlive" | "timer"): void {
    if (this.state.status !== "PLAYING" && this.state.status !== "COUNTDOWN") {
      return;
    }
    const now = Date.now();
    this.state.status = "ENDED";
    this.state.endedAtMs = now;

    const ranked = this.rankPlayers();
    ranked.forEach((p, idx) => {
      p.placement = idx + 1;
    });

    if (!this.resultPosted) {
      this.resultPosted = true;
      const participants: ResultParticipant[] = ranked.map((p) => ({
        email: p.email,
        displayName: p.displayName,
        placement: p.placement,
        kills: p.kills,
        survivedSeconds: this.computeSurvivedSeconds(p),
      }));
      const payload = {
        matchId: this.state.matchId,
        startedAt: new Date(this.startedAtServerMs || now).toISOString(),
        endedAt: new Date(now).toISOString(),
        winnerEmail: ranked[0]?.email ?? null,
        participants,
      };
      postMatchResult(payload).catch((err) =>
        console.error("[SurvivorRoom] postMatchResult failed", err)
      );
    }
    console.log(`[SurvivorRoom] endMatch reason=${reason}`);
  }

  /** Read-only snapshot for /admin/state debugging. */
  adminSnapshot() {
    return {
      status: this.state.status,
      matchId: this.state.matchId,
      prizeTitle: this.state.prizeTitle,
      startedAtMs: this.state.startedAtMs,
      matchEndsAtMs: this.state.matchEndsAtMs,
      players: Array.from(this.state.players.values()).map((p) => ({
        email: p.email,
        displayName: p.displayName,
        alive: p.alive,
        hp: p.hp,
        kills: p.kills,
        connected: p.connected,
        placement: p.placement,
      })),
      alive: this.countAlive(),
      obstacleCount: this.state.obstacles.length,
    };
  }

  // ---------- Tick ----------

  private tick(dtMs: number) {
    try {
      this.tickSimulation(dtMs);
    } catch (err) {
      console.error("[SurvivorRoom] tick error (match kept alive)", err);
    }
  }

  private tickSimulation(dtMs: number) {
    const now = Date.now();
    const dtSec = dtMs / 1000;
    if (this.state.status !== "PLAYING") return;

    const events = emptyEvents();

    tickPlayers(this.state, this.inputs, dtSec);
    tickShooting(this.state, this.inputs, now);
    tickBullets(this.state, dtSec, now, events);
    tickZone(this.state, dtSec, now, events);
    this.pickupCtx = tickPickups(this.state, this.pickupCtx, now, events);

    // Forward transient events as room messages so the client can fire
    // kill-feed + pickup toast UI immediately without waiting for the next
    // schema patch.
    if (events.kills.length > 0) {
      this.broadcast("event:kills", events.kills);
    }
    if (events.pickupsCollected.length > 0) {
      // Send pickup events targeted to the specific session so each player's
      // toast only fires for their own pickups.
      for (const ev of events.pickupsCollected) {
        const cli = this.clients.find((c) => c.sessionId === ev.sessionId);
        cli?.send("event:pickup", { kind: ev.kind });
      }
    }

    // End conditions: last alive OR timer expired.
    const aliveCount = this.countAlive();
    if (aliveCount <= 1) {
      this.endMatch(aliveCount === 1 ? "lastAlive" : "lastAlive");
      return;
    }
    if (now >= this.state.matchEndsAtMs) {
      this.endMatch("timer");
    }
  }

  private beginPlaying() {
    if (this.state.status !== "COUNTDOWN") return;
    const now = Date.now();
    this.state.status = "PLAYING";
    this.state.startedAtMs = now;
    this.startedAtServerMs = now;
    this.state.zoneShrink01 = 0;
    this.state.zone.radius = ZONE_START_RADIUS;
    this.state.zone.targetRadius = ZONE_START_RADIUS;
    // matchEndsAtMs was set in startMatch; just nudge to a clean value.
    this.state.countdownEndsAtMs = 0;
    // Skip the very first beat so pickups appear shortly after combat begins
    // instead of dropping on top of fresh spawns.
    this.pickupCtx = { nextSpawnAtMs: now + Math.floor(PICKUP_SPAWN_INTERVAL_MS * 0.6) };
    console.log("[SurvivorRoom] PLAYING");
  }

  // ---------- Helpers ----------

  private rateLimitInput(sessionId: string): boolean {
    const now = Date.now();
    let c = this.inputCounters.get(sessionId);
    if (!c || now - c.windowStart > 1000) {
      c = { windowStart: now, count: 0 };
      this.inputCounters.set(sessionId, c);
    }
    c.count++;
    return c.count <= MAX_INPUTS_PER_SEC;
  }

  private countAlive(): number {
    let n = 0;
    this.state.players.forEach((p) => {
      if (p.alive && p.connected) n++;
    });
    return n;
  }

  /**
   * Place new spawns on a circle inside the starting zone, biased toward
   * the perimeter so players don't pile on top of each other. Retries a
   * handful of times to avoid landing inside an obstacle.
   */
  private pickSpawn(): { x: number; y: number } {
    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const r = ZONE_START_RADIUS * (0.55 + Math.random() * 0.35);
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      let inside = false;
      this.state.obstacles.forEach((o) => {
        if (inside) return;
        if (
          x > o.x - o.w / 2 - 24 &&
          x < o.x + o.w / 2 + 24 &&
          y > o.y - o.h / 2 - 24 &&
          y < o.y + o.h / 2 + 24
        ) {
          inside = true;
        }
      });
      if (!inside) return { x, y };
    }
    // Fallback: original behaviour. Player will be auto-pushed out by the
    // next tickPlayers() pass anyway.
    const angle = Math.random() * Math.PI * 2;
    const r = ZONE_START_RADIUS * 0.6;
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
  }

  /**
   * Rank players for placement. Survivors come before deaths, then deaths by
   * deathAt (later = higher), kills as tiebreaker, then HP remaining.
   */
  private rankPlayers(): Player[] {
    const all = Array.from(this.state.players.values());
    all.sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      // Both alive: kills then HP
      if (a.alive && b.alive) {
        if (b.kills !== a.kills) return b.kills - a.kills;
        return b.hp - a.hp;
      }
      // Both dead: later death wins, then kills
      if (b.deathAt !== a.deathAt) return b.deathAt - a.deathAt;
      return b.kills - a.kills;
    });
    return all;
  }

  private computeSurvivedSeconds(p: Player): number {
    if (!this.startedAtServerMs) return 0;
    const endMs = p.alive
      ? this.state.endedAtMs || Date.now()
      : p.deathAt || this.state.endedAtMs || Date.now();
    return Math.max(0, Math.floor((endMs - this.startedAtServerMs) / 1000));
  }

  private resetForNewMatch(kickClients = true) {
    if (kickClients) {
      this.state.players.forEach((_, sessionId) => {
        // Existing clients have to rejoin via the new matchId; cleanest is to
        // disconnect them all so they re-flow through onAuth.
        const cli = this.clients.find((c) => c.sessionId === sessionId);
        cli?.leave(4000, "New match starting");
      });
    }
    this.state.players.clear();
    this.state.bullets.clear();
    this.state.pickups.clear();
    this.state.obstacles.clear();
    this.inputs.clear();
    this.inputCounters.clear();
    this.state.endedAtMs = 0;
    this.state.startedAtMs = 0;
    this.state.countdownEndsAtMs = 0;
    this.state.zoneShrink01 = 0;
    this.state.matchEndsAtMs = 0;
    this.state.zone.radius = ZONE_START_RADIUS;
    this.state.zone.targetRadius = ZONE_START_RADIUS;
    this.resultPosted = false;
    this.startedAtServerMs = 0;
    this.pickupCtx = freshPickupCtx();
  }

  override onDispose() {
    console.log("[SurvivorRoom] disposed");
  }
}
