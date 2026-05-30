import { Room, Client } from "@colyseus/core";
import { Player } from "./state";
import { EscapeLunaState } from "./luna-state";
import {
  TICK_MS,
  PLAYER_MAX_HP,
  MAX_PLAYERS,
  DEFAULT_WEAPON,
  DEFAULT_SLIME_COLOR,
  DEFAULT_NAME_COLOR,
  parseSlimeColor,
  parseSlimeFace,
  parseSlimeAccessories,
  parseNameColor,
  MAX_INPUTS_PER_SEC,
  LUNA_ZONE_START_RADIUS,
} from "./luna-constants";
import { verifyMatchToken } from "./hmac";
import {
  emptyInput,
  sanitizeInput,
  generateLunaMaze,
  spawnLunaDog,
  tickLunaDog,
  tickLunaPlayers,
  tickLunaZone,
  maxLunaSpawnRadius,
  isSafeLunaSpawnPoint,
  type PlayerInput,
} from "./luna-physics";
import { postLunaMatchResult, type ResultParticipant } from "./webhook";

export class EscapeLunaRoom extends Room<EscapeLunaState> {
  maxClients = 200;
  override autoDispose = false;

  private inputs = new Map<string, PlayerInput>();
  private inputCounters = new Map<string, { windowStart: number; count: number }>();
  private startedAtServerMs = 0;
  private resultPosted = false;
  private playersAtMatchStart = 0;

  override onCreate() {
    const state = new EscapeLunaState();
    state.zone.cx = 0;
    state.zone.cy = 0;
    state.zone.radius = LUNA_ZONE_START_RADIUS;
    state.zone.targetRadius = LUNA_ZONE_START_RADIUS;
    state.status = "WAITING";
    this.setState(state);

    this.onMessage("input", (client, raw) => {
      if (!this.rateLimitInput(client.sessionId)) return;
      const inp = sanitizeInput(raw);
      if (!inp) return;
      const player = this.state.players.get(client.sessionId);
      if (!player?.alive) return;
      this.inputs.set(client.sessionId, inp);
    });

    this.setSimulationInterval((dtMs) => this.tick(dtMs), TICK_MS);
    this.setPatchRate(TICK_MS);
    console.log("[EscapeLunaRoom] created");
  }

  override async onAuth(
    _client: Client,
    options: Record<string, unknown>
  ): Promise<{
    email: string;
    displayName: string;
    matchId: string;
    isSpectator: boolean;
    slimeColor: string;
    slimeFace: number;
    slimeAccessories: number;
    nameColor: string;
  }> {
    const email = String(options.email ?? "").trim().toLowerCase();
    const displayName = String(options.displayName ?? "").trim().slice(0, 32);
    const matchId = String(options.matchId ?? "").trim();
    const issuedAtMs = Number(options.issuedAtMs);
    const matchToken = String(options.matchToken ?? "");

    if (!email || !displayName || !matchId || !matchToken) {
      throw new Error("Missing join credentials");
    }
    if (!Number.isFinite(issuedAtMs)) throw new Error("Missing token timestamp");
    if (matchId !== this.state.matchId) {
      if (!this.state.matchId) {
        throw new Error("Game server restarted — ask admin to open a new match.");
      }
      throw new Error("Match has moved on — refresh the lobby.");
    }
    if (
      !verifyMatchToken({ matchId, email, displayName, issuedAtMs }, matchToken)
    ) {
      throw new Error("Invalid join token");
    }

    const existingEntry = Array.from(this.state.players.entries()).find(
      ([, p]) => p.email === email
    );
    const inLobby =
      this.state.status === "WAITING" || this.state.status === "COUNTDOWN";

    if (this.state.status === "PLAYING") {
      if (!existingEntry) {
        throw new Error("Match already in progress — wait for the next one.");
      }
      const [, existingPlayer] = existingEntry;
      if (existingPlayer.connected) {
        throw new Error("You are already in this match in another tab.");
      }
      throw new Error(
        existingPlayer.alive
          ? "Reconnect window expired — you can't re-enter this match."
          : "You were caught — wait for the next match."
      );
    }
    if (this.state.status === "ENDED") {
      throw new Error("This match has ended — wait for the next one.");
    }

    if (existingEntry) {
      const [existingSessionId, existingPlayer] = existingEntry;
      if (existingPlayer.connected) {
        throw new Error("You are already in this match in another tab.");
      }
      this.state.players.delete(existingSessionId);
      this.inputs.delete(existingSessionId);
      this.inputCounters.delete(existingSessionId);
    }

    const alivePlayers = this.countAlive();
    if (inLobby && alivePlayers >= MAX_PLAYERS) {
      throw new Error("Match is full (25 players).");
    }
    const isSpectator = !(inLobby && alivePlayers < MAX_PLAYERS);

    return {
      email,
      displayName,
      matchId,
      isSpectator,
      slimeColor: parseSlimeColor(options.slimeColor),
      slimeFace: parseSlimeFace(options.slimeFace),
      slimeAccessories: parseSlimeAccessories(options.slimeAccessories),
      nameColor: parseNameColor(options.nameColor),
    };
  }

  override onJoin(
    client: Client,
    _options: Record<string, unknown>,
    auth: {
      email: string;
      displayName: string;
      matchId: string;
      isSpectator: boolean;
      slimeColor: string;
      slimeFace: number;
      slimeAccessories: number;
      nameColor: string;
    }
  ): void {
    const p = new Player();
    p.email = auth.email;
    p.displayName = auth.displayName;
    p.slimeColor = auth.slimeColor || DEFAULT_SLIME_COLOR;
    p.slimeFace = auth.slimeFace ?? 0;
    p.slimeAccessories = auth.slimeAccessories ?? 0;
    p.nameColor = auth.nameColor || DEFAULT_NAME_COLOR;
    p.connected = true;
    p.weapon = DEFAULT_WEAPON;
    p.kills = 0;

    if (auth.isSpectator) {
      p.alive = false;
      p.hp = 0;
    } else {
      const spawn = this.pickSpawn();
      p.x = spawn.x;
      p.y = spawn.y;
      p.hp = PLAYER_MAX_HP;
      p.maxHp = PLAYER_MAX_HP;
      p.alive = true;
    }
    this.state.players.set(client.sessionId, p);
    this.inputs.set(client.sessionId, emptyInput());
    console.log(`[EscapeLunaRoom] join ${client.sessionId} (${auth.email})`);
  }

  private static readonly RECONNECT_SECONDS = 90;

  override async onLeave(client: Client, consented: boolean): Promise<void> {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    const status = this.state.status;
    const canReconnect =
      !consented &&
      (status === "PLAYING" || status === "COUNTDOWN" || status === "WAITING");

    if (canReconnect) {
      p.connected = false;
      this.inputs.delete(client.sessionId);
      this.inputCounters.delete(client.sessionId);
      try {
        await this.allowReconnection(client, EscapeLunaRoom.RECONNECT_SECONDS);
        p.connected = true;
        this.inputs.set(client.sessionId, emptyInput());
      } catch {
        this.finalizeLeave(client.sessionId, p, status);
      }
      return;
    }
    this.finalizeLeave(client.sessionId, p, status);
  }

  private finalizeLeave(
    sessionId: string,
    p: Player,
    status: EscapeLunaState["status"]
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
  }

  startMatch(
    matchId: string,
    prizeTitle: string,
    matchSeconds: number,
    lobbySeconds: number
  ): void {
    if (this.state.status === "PLAYING" || this.state.status === "COUNTDOWN") {
      throw new Error(
        "Match already in progress on the game server — end it before starting a new one."
      );
    }
    this.resetForNewMatch(false);
    this.state.zone.radius = LUNA_ZONE_START_RADIUS;
    this.state.zone.targetRadius = LUNA_ZONE_START_RADIUS;
    generateLunaMaze(this.state);

    const now = Date.now();
    this.state.matchId = matchId;
    this.state.prizeTitle = prizeTitle;
    this.state.status = "COUNTDOWN";
    this.state.countdownEndsAtMs = now + lobbySeconds * 1000;
    this.state.matchEndsAtMs = this.state.countdownEndsAtMs + matchSeconds * 1000;

    this.clock.setTimeout(() => this.beginPlaying(), lobbySeconds * 1000);
    console.log(
      `[EscapeLunaRoom] startMatch matchId=${matchId} obstacles=${this.state.obstacles.length}`
    );
  }

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
    this.state.zone.radius = LUNA_ZONE_START_RADIUS;
    this.state.zone.targetRadius = LUNA_ZONE_START_RADIUS;
    generateLunaMaze(this.state);

    const now = Date.now();
    this.state.matchId = matchId;
    this.state.prizeTitle = prizeTitle;

    if (targetStatus === "PLAYING" && startedAtMs > 0 && matchEndsAtMs > startedAtMs) {
      this.state.status = "PLAYING";
      this.state.startedAtMs = startedAtMs;
      this.startedAtServerMs = startedAtMs;
      this.state.matchEndsAtMs = matchEndsAtMs;
      this.playersAtMatchStart = this.countAlive();
      spawnLunaDog(this.state);
      tickLunaZone(this.state, 0, now);
      return;
    }

    this.state.status = "COUNTDOWN";
    this.state.countdownEndsAtMs = now + lobbySeconds * 1000;
    this.state.matchEndsAtMs = this.state.countdownEndsAtMs + matchSeconds * 1000;
    this.clock.setTimeout(() => this.beginPlaying(), lobbySeconds * 1000);
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
        kills: 0,
        survivedSeconds: this.computeSurvivedSeconds(p),
      }));
      postLunaMatchResult({
        matchId: this.state.matchId,
        startedAt: new Date(this.startedAtServerMs || now).toISOString(),
        endedAt: new Date(now).toISOString(),
        winnerEmail: ranked[0]?.email ?? null,
        participants,
      }).catch((err) => console.error("[EscapeLunaRoom] postMatchResult failed", err));
    }
    console.log(`[EscapeLunaRoom] endMatch reason=${reason}`);
  }

  adminSnapshot() {
    return {
      status: this.state.status,
      matchId: this.state.matchId,
      prizeTitle: this.state.prizeTitle,
      countdownEndsAtMs: this.state.countdownEndsAtMs,
      dog: {
        x: this.state.dog.x,
        y: this.state.dog.y,
        speed: this.state.dog.speed,
        targetSessionId: this.state.dog.targetSessionId,
      },
      alive: this.countAlive(),
      obstacleCount: this.state.obstacles.length,
    };
  }

  private tick(dtMs: number) {
    try {
      this.tickSimulation(dtMs);
    } catch (err) {
      console.error("[EscapeLunaRoom] tick error", err);
    }
  }

  private tickSimulation(dtMs: number) {
    const now = Date.now();
    const dtSec = dtMs / 1000;
    if (this.state.status !== "PLAYING") return;

    tickLunaPlayers(this.state, this.inputs, dtSec, now);
    tickLunaDog(this.state, this.inputs, dtSec, now);
    tickLunaZone(this.state, dtSec, now);

    const aliveCount = this.countAlive();
    if (aliveCount < 1 && this.playersAtMatchStart > 0) {
      this.endMatch("lastAlive");
      return;
    }
    if (aliveCount === 1 && this.playersAtMatchStart > 1) {
      this.endMatch("lastAlive");
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
    this.state.zone.radius = LUNA_ZONE_START_RADIUS;
    this.state.zone.targetRadius = LUNA_ZONE_START_RADIUS;
    this.state.countdownEndsAtMs = 0;
    this.playersAtMatchStart = this.countAlive();
    this.relocatePlayersToSafeSpawns();
    spawnLunaDog(this.state);
    console.log("[EscapeLunaRoom] PLAYING — Luna is loose");
  }

  /** Players may have joined during COUNTDOWN at coords outside the world square. */
  private relocatePlayersToSafeSpawns() {
    this.state.players.forEach((p) => {
      if (!p.alive) return;
      if (isSafeLunaSpawnPoint(this.state, p.x, p.y)) return;
      const spawn = this.pickSpawn();
      p.x = spawn.x;
      p.y = spawn.y;
    });
  }

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

  private pickSpawn(): { x: number; y: number } {
    const maxR = maxLunaSpawnRadius(this.state);
    const minR = Math.min(220, maxR * 0.35);
    for (let attempt = 0; attempt < 24; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const r = minR + Math.random() * (maxR - minR);
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (isSafeLunaSpawnPoint(this.state, x, y)) return { x, y };
    }
    const angle = Math.random() * Math.PI * 2;
    const r = maxR * 0.55;
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
  }

  private rankPlayers(): Player[] {
    const all = Array.from(this.state.players.values());
    all.sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      if (a.alive && b.alive) return b.hp - a.hp;
      if (b.deathAt !== a.deathAt) return b.deathAt - a.deathAt;
      return 0;
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
        const cli = this.clients.find((c) => c.sessionId === sessionId);
        cli?.leave(4000, "New match starting");
      });
    }
    this.state.players.clear();
    this.state.obstacles.clear();
    this.state.pits.clear();
    this.inputs.clear();
    this.inputCounters.clear();
    this.state.endedAtMs = 0;
    this.state.startedAtMs = 0;
    this.state.countdownEndsAtMs = 0;
    this.state.zoneShrink01 = 0;
    this.state.matchEndsAtMs = 0;
    this.playersAtMatchStart = 0;
    this.state.zone.radius = LUNA_ZONE_START_RADIUS;
    this.state.zone.targetRadius = LUNA_ZONE_START_RADIUS;
    spawnLunaDog(this.state);
    this.resultPosted = false;
    this.startedAtServerMs = 0;
  }
}
