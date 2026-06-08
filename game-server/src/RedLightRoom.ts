import { Room, Client } from "@colyseus/core";
import { Player } from "./state";
import { RedLightState } from "./red-light-state";
import {
  DEFAULT_NAME_COLOR,
  DEFAULT_SLIME_COLOR,
  DEFAULT_WEAPON,
  MAX_INPUTS_PER_SEC,
  MAX_PLAYERS,
  parseNameColor,
  parseSlimeAccessories,
  parseSlimeColor,
  parseSlimeFace,
  RED_LIGHT_MAX_PLAYERS,
  TICK_MS,
} from "./red-light-constants";
import {
  assignFinalPlacements,
  emptyInput,
  initLightCycle,
  pickSpawnSlot,
  resetRedLightMatch,
  sanitizeInput,
  tickRedLightPlayers,
  type PlayerInput,
} from "./red-light-physics";
import { verifyMatchToken } from "./hmac";
import { postRedLightMatchResult, type ResultParticipant } from "./webhook";

export class RedLightRoom extends Room<RedLightState> {
  maxClients = RED_LIGHT_MAX_PLAYERS + 50;
  override autoDispose = false;

  private inputs = new Map<string, PlayerInput>();
  private inputCounters = new Map<string, { count: number; windowStart: number }>();
  private startedAtServerMs = 0;
  private playersAtMatchStart = 0;
  private resultPosted = false;
  private spawnIndex = 0;

  override onCreate(): void {
    this.setState(new RedLightState());
    this.onMessage("input", (client, raw) => {
      if (!this.rateLimitInput(client.sessionId)) return;
      const inp = sanitizeInput(raw);
      if (!inp) return;
      const player = this.state.players.get(client.sessionId);
      if (!player?.alive) return;
      this.inputs.set(client.sessionId, inp);
    });
    this.setSimulationInterval(() => this.tick(), TICK_MS);
    console.log("[RedLightRoom] created");
  }

  private rateLimitInput(sessionId: string): boolean {
    const now = Date.now();
    let counter = this.inputCounters.get(sessionId);
    if (!counter) {
      counter = { count: 0, windowStart: now };
      this.inputCounters.set(sessionId, counter);
    }
    if (now - counter.windowStart >= 1000) {
      counter.count = 0;
      counter.windowStart = now;
    }
    counter.count += 1;
    return counter.count <= MAX_INPUTS_PER_SEC;
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
        return {
          email,
          displayName,
          matchId,
          isSpectator: true,
          slimeColor: parseSlimeColor(options.slimeColor),
          slimeFace: parseSlimeFace(options.slimeFace),
          slimeAccessories: parseSlimeAccessories(options.slimeAccessories),
          nameColor: parseNameColor(options.nameColor),
        };
      }
      const [, existingPlayer] = existingEntry;
      if (existingPlayer.connected) {
        throw new Error("You are already in this match in another tab.");
      }
      if (existingPlayer.alive) {
        throw new Error("Reconnect window expired — you can't re-enter this match.");
      }
      throw new Error("You were eliminated — wait for the next match.");
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

    const fighterCount = this.countLobbyFighters();
    const canJoinActive = inLobby && fighterCount < MAX_PLAYERS;
    const isSpectator = inLobby && !canJoinActive;

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
      p.x = 0;
      p.y = this.state.startLineY;
    } else {
      const slot = pickSpawnSlot(this.spawnIndex, RED_LIGHT_MAX_PLAYERS);
      this.spawnIndex += 1;
      p.x = slot.x;
      p.y = slot.y;
      p.hp = 100;
      p.maxHp = 100;
      p.alive = true;
    }
    this.state.players.set(client.sessionId, p);
    this.inputs.set(client.sessionId, emptyInput());
    console.log(`[RedLightRoom] join ${client.sessionId} (${auth.email})`);
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
        await this.allowReconnection(client, RedLightRoom.RECONNECT_SECONDS);
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
    status: RedLightState["status"]
  ): void {
    p.connected = false;
    if (status === "WAITING" || status === "COUNTDOWN") {
      this.state.players.delete(sessionId);
      this.spawnIndex = Math.max(0, this.spawnIndex - 1);
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
    this.spawnIndex = 0;

    const now = Date.now();
    this.state.matchId = matchId;
    this.state.prizeTitle = prizeTitle;
    this.state.status = "COUNTDOWN";
    this.state.countdownEndsAtMs = now + lobbySeconds * 1000;
    this.state.matchEndsAtMs = this.state.countdownEndsAtMs + matchSeconds * 1000;

    this.clock.setTimeout(() => this.beginPlaying(), lobbySeconds * 1000);
    console.log(`[RedLightRoom] startMatch matchId=${matchId}`);
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
    this.spawnIndex = 0;

    const now = Date.now();
    this.state.matchId = matchId;
    this.state.prizeTitle = prizeTitle;

    if (targetStatus === "PLAYING" && startedAtMs > 0 && matchEndsAtMs > startedAtMs) {
      this.state.status = "PLAYING";
      this.state.startedAtMs = startedAtMs;
      this.startedAtServerMs = startedAtMs;
      this.state.matchEndsAtMs = matchEndsAtMs;
      this.playersAtMatchStart = this.countAlive();
      initLightCycle(this.state, now);
      const remaining = matchEndsAtMs - now;
      if (remaining > 0) {
        this.clock.setTimeout(() => this.endMatch("time"), remaining);
      }
      return;
    }

    this.state.status = "COUNTDOWN";
    const countdownEnd = now + lobbySeconds * 1000;
    this.state.countdownEndsAtMs = countdownEnd;
    this.state.matchEndsAtMs = countdownEnd + matchSeconds * 1000;
    const waitMs = Math.max(0, countdownEnd - now);
    this.clock.setTimeout(() => this.beginPlaying(), waitMs);
  }

  endMatch(reason: "time" | "admin" | "all_finished" = "time"): void {
    if (this.state.status !== "PLAYING" && this.state.status !== "COUNTDOWN") return;

    const now = Date.now();
    this.state.status = "ENDED";
    this.state.endedAtMs = now;
    assignFinalPlacements(this.state);
    this.postResult(reason);
    console.log(`[RedLightRoom] endMatch reason=${reason} matchId=${this.state.matchId}`);
  }

  private beginPlaying(): void {
    if (this.state.status !== "COUNTDOWN") return;
    const now = Date.now();
    this.state.status = "PLAYING";
    this.state.startedAtMs = now;
    this.startedAtServerMs = now;
    this.playersAtMatchStart = this.countAlive();
    initLightCycle(this.state, now);

    const remaining = this.state.matchEndsAtMs - now;
    if (remaining > 0) {
      this.clock.setTimeout(() => this.endMatch("time"), remaining);
    }
    console.log(`[RedLightRoom] PLAYING players=${this.playersAtMatchStart}`);
  }

  private tick(): void {
    if (this.state.status !== "PLAYING") return;
    const now = Date.now();
    tickRedLightPlayers(this.state, this.inputs, TICK_MS / 1000, now);

    const alive = this.countAlive();
    if (alive === 0 && this.playersAtMatchStart > 0) {
      this.endMatch("all_finished");
    }
  }

  adminSnapshot() {
    return {
      status: this.state.status,
      matchId: this.state.matchId,
      prizeTitle: this.state.prizeTitle,
      countdownEndsAtMs: this.state.countdownEndsAtMs,
      lightPhase: this.state.lightPhase,
      roundNumber: this.state.roundNumber,
      phaseEndsAtMs: this.state.phaseEndsAtMs,
      alive: this.countAlive(),
    };
  }

  private countAlive(): number {
    let n = 0;
    this.state.players.forEach((p) => {
      if (p.alive && p.connected) n++;
    });
    return n;
  }

  private countFinished(): number {
    let n = 0;
    this.state.players.forEach((p) => {
      if (p.placement > 0) n++;
    });
    return n;
  }

  private countLobbyFighters(): number {
    let n = 0;
    this.state.players.forEach((p) => {
      if (p.alive) n++;
    });
    return n;
  }

  private computeSurvivedSeconds(p: Player): number {
    if (!this.startedAtServerMs) return 0;
    const endMs = p.alive
      ? this.state.endedAtMs || Date.now()
      : p.deathAt || this.state.endedAtMs || Date.now();
    return Math.max(0, Math.floor((endMs - this.startedAtServerMs) / 1000));
  }

  private postResult(_reason: string): void {
    if (this.resultPosted || !this.state.matchId) return;
    this.resultPosted = true;

    const now = this.state.endedAtMs || Date.now();
    const ranked = Array.from(this.state.players.values())
      .filter((p) => p.placement > 0 || p.deathAt > 0)
      .sort((a, b) => {
        if (a.placement && b.placement) return a.placement - b.placement;
        if (a.placement) return -1;
        if (b.placement) return 1;
        return a.y - b.y;
      });

    const participants: ResultParticipant[] = ranked.map((p, i) => ({
      email: p.email,
      displayName: p.displayName,
      placement: p.placement || i + 1,
      kills: 0,
      survivedSeconds: this.computeSurvivedSeconds(p),
    }));

    void postRedLightMatchResult({
      matchId: this.state.matchId,
      startedAt: new Date(this.startedAtServerMs || now).toISOString(),
      endedAt: new Date(now).toISOString(),
      winnerEmail: ranked[0]?.email ?? null,
      participants,
    }).catch((err) => console.error("[RedLightRoom] postMatchResult failed", err));
  }

  private resetForNewMatch(kickClients = true) {
    if (kickClients) {
      this.state.players.forEach((_, sessionId) => {
        const cli = this.clients.find((c) => c.sessionId === sessionId);
        cli?.leave(4000, "New match starting");
      });
    }
    this.state.players.clear();
    this.inputs.clear();
    this.inputCounters.clear();
    resetRedLightMatch(this.state);
    this.state.endedAtMs = 0;
    this.state.startedAtMs = 0;
    this.state.countdownEndsAtMs = 0;
    this.state.matchEndsAtMs = 0;
    this.playersAtMatchStart = 0;
    this.resultPosted = false;
    this.startedAtServerMs = 0;
    this.spawnIndex = 0;
    this.state.status = "WAITING";
    this.state.matchId = "";
    this.state.prizeTitle = "";
  }
}
