import { Room, Client } from "@colyseus/core";
import { SurvivorState, Player } from "./state";
import {
  TICK_MS,
  PLAYER_MAX_HP,
  MAX_PLAYERS,
  DEFAULT_LOBBY_SECONDS,
  ZONE_START_RADIUS,
  MAX_INPUTS_PER_SEC,
} from "./constants";
import { verifyMatchToken } from "./hmac";
import {
  tickPlayers,
  tickShooting,
  tickBullets,
  tickZone,
  sanitizeInput,
  emptyInput,
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
      throw new Error("Match has moved on — refresh the lobby.");
    }
    const ok = verifyMatchToken(
      { matchId, email, displayName, issuedAtMs },
      matchToken
    );
    if (!ok) {
      throw new Error("Invalid join token");
    }
    // One connection per email. If they reconnect after dropping, the
    // disconnected slot still occupies the map until we clear it; this is
    // intentional for v1 (no resume).
    const existing = Array.from(this.state.players.values()).find(
      (p) => p.email === email
    );
    if (existing) {
      throw new Error("You are already in this match in another tab.");
    }

    // Both WAITING and COUNTDOWN admit active players. PLAYING/ENDED only
    // admit spectators.
    const inLobby =
      this.state.status === "WAITING" || this.state.status === "COUNTDOWN";
    const alivePlayers = this.countAlive();
    if (inLobby && alivePlayers >= MAX_PLAYERS) {
      throw new Error("Match is full (25 players).");
    }
    const isSpectator = !inLobby;
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

  override onLeave(client: Client, _consented: boolean): void {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    p.connected = false;
    // If the match hasn't started yet, free the slot completely; otherwise
    // count the leave as a death so the round can still resolve cleanly.
    if (this.state.status === "WAITING") {
      this.state.players.delete(client.sessionId);
    } else if (p.alive) {
      p.alive = false;
      p.deathAt = Date.now();
    }
    this.inputs.delete(client.sessionId);
    this.inputCounters.delete(client.sessionId);
    console.log(`[SurvivorRoom] leave ${client.sessionId}`);
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
    // Kick everyone from any previous match before swapping matchId.
    this.resetForNewMatch();

    const now = Date.now();
    this.state.matchId = matchId;
    this.state.prizeTitle = prizeTitle;
    this.state.status = "COUNTDOWN";
    this.state.countdownEndsAtMs = now + lobbySeconds * 1000;
    this.state.matchEndsAtMs =
      this.state.countdownEndsAtMs + matchSeconds * 1000;
    this.matchPrize = prizeTitle;

    console.log(
      `[SurvivorRoom] startMatch matchId=${matchId} lobby=${lobbySeconds}s match=${matchSeconds}s`
    );

    this.clock.setTimeout(() => {
      this.beginPlaying();
    }, lobbySeconds * 1000);
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
    };
  }

  // ---------- Tick ----------

  private tick(dtMs: number) {
    const now = Date.now();
    const dtSec = dtMs / 1000;
    if (this.state.status !== "PLAYING") return;

    tickPlayers(this.state, this.inputs, dtSec);
    tickShooting(this.state, this.inputs, now);
    tickBullets(this.state, dtSec, now);
    tickZone(this.state, dtSec, now);

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
    // matchEndsAtMs was set in startMatch; just nudge to a clean value.
    this.state.countdownEndsAtMs = 0;
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
   * the perimeter so players don't pile on top of each other.
   */
  private pickSpawn(): { x: number; y: number } {
    const angle = Math.random() * Math.PI * 2;
    const r = ZONE_START_RADIUS * (0.55 + Math.random() * 0.35);
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

  private resetForNewMatch() {
    this.state.players.forEach((_, sessionId) => {
      // Existing clients have to rejoin via the new matchId; cleanest is to
      // disconnect them all so they re-flow through onAuth.
      const cli = this.clients.find((c) => c.sessionId === sessionId);
      cli?.leave(4000, "New match starting");
    });
    this.state.players.clear();
    this.state.bullets.clear();
    this.inputs.clear();
    this.inputCounters.clear();
    this.state.endedAtMs = 0;
    this.state.startedAtMs = 0;
    this.state.countdownEndsAtMs = 0;
    this.state.matchEndsAtMs = 0;
    this.state.zone.radius = ZONE_START_RADIUS;
    this.state.zone.targetRadius = ZONE_START_RADIUS;
    this.resultPosted = false;
    this.startedAtServerMs = 0;
  }

  override onDispose() {
    console.log("[SurvivorRoom] disposed");
  }
}
