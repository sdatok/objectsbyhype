import type { Player } from "./state";
import type { RedLightState } from "./red-light-state";
import {
  RLGL_FINISH_Y,
  RLGL_FORWARD_THRESHOLD,
  RLGL_MAX_SPEED,
  RLGL_ACCEL,
  RLGL_DECEL,
  RLGL_MOVE_TOLERANCE,
  RLGL_START_Y,
  RLGL_TRACK_WIDTH,
  rlglRoundTiming,
  type LightPhase,
} from "./red-light-constants";

export interface PlayerInput {
  moveX: number;
  moveY: number;
  forward: boolean;
}

export function emptyInput(): PlayerInput {
  return { moveX: 0, moveY: 0, forward: false };
}

export function sanitizeInput(raw: unknown): PlayerInput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const moveX = Number(o.moveX);
  const moveY = Number(o.moveY);
  if (!Number.isFinite(moveX) || !Number.isFinite(moveY)) return null;
  const forward =
    o.forward === true ||
    moveY < -RLGL_FORWARD_THRESHOLD ||
    (o.shooting === true && moveY <= 0);
  return {
    moveX: Math.max(-1, Math.min(1, moveX)),
    moveY: Math.max(-1, Math.min(1, moveY)),
    forward,
  };
}

const redSnapshots = new WeakMap<
  RedLightState,
  Map<string, { x: number; y: number }>
>();

const forwardVelocity = new WeakMap<RedLightState, Map<string, number>>();

function velocityMap(state: RedLightState): Map<string, number> {
  let m = forwardVelocity.get(state);
  if (!m) {
    m = new Map();
    forwardVelocity.set(state, m);
  }
  return m;
}

function snapshotMap(state: RedLightState): Map<string, { x: number; y: number }> {
  let m = redSnapshots.get(state);
  if (!m) {
    m = new Map();
    redSnapshots.set(state, m);
  }
  return m;
}

export function resetRedLightMatch(state: RedLightState) {
  snapshotMap(state).clear();
  velocityMap(state).clear();
  state.lightPhase = "GREEN";
  state.roundNumber = 1;
  state.phaseEndsAtMs = 0;
}

export function initLightCycle(state: RedLightState, nowMs: number) {
  const timing = rlglRoundTiming(state.roundNumber);
  state.lightPhase = "GREEN";
  state.phaseEndsAtMs = nowMs + timing.greenMs;
}

export function advanceLightPhase(state: RedLightState, nowMs: number) {
  const timing = rlglRoundTiming(state.roundNumber);
  const phase = state.lightPhase as LightPhase;

  if (phase === "GREEN") {
    state.lightPhase = "TURNING";
    state.phaseEndsAtMs = nowMs + timing.turningMs;
    captureRedSnapshots(state);
    return;
  }

  if (phase === "TURNING") {
    state.lightPhase = "RED";
    state.phaseEndsAtMs = nowMs + timing.redMs;
    return;
  }

  state.roundNumber += 1;
  state.lightPhase = "GREEN";
  state.phaseEndsAtMs = nowMs + rlglRoundTiming(state.roundNumber).greenMs;
  snapshotMap(state).clear();
}

function captureRedSnapshots(state: RedLightState) {
  const map = snapshotMap(state);
  map.clear();
  state.players.forEach((p, id) => {
    if (!p.alive) return;
    map.set(id, { x: p.x, y: p.y });
  });
}

export function tickRedLightPlayers(
  state: RedLightState,
  inputs: Map<string, PlayerInput>,
  dtSec: number,
  nowMs: number
) {
  if (state.status !== "PLAYING") return;

  if (state.phaseEndsAtMs > 0 && nowMs >= state.phaseEndsAtMs) {
    advanceLightPhase(state, nowMs);
  }

  const phase = state.lightPhase as LightPhase;
  const halfW = RLGL_TRACK_WIDTH / 2 - 24;
  const snapshots = snapshotMap(state);
  const velocities = velocityMap(state);
  let finishOrder = countFinished(state);
  const roundBoost = 1 + Math.min(0.12, state.roundNumber * 0.018);

  state.players.forEach((p, sessionId) => {
    if (!p.alive) return;

    const inp = inputs.get(sessionId) ?? emptyInput();
    let v = velocities.get(sessionId) ?? 0;
    const wantsForward =
      inp.forward || inp.moveY < -RLGL_FORWARD_THRESHOLD;

    if (phase === "GREEN") {
      if (wantsForward) {
        v = Math.min(RLGL_MAX_SPEED * roundBoost, v + RLGL_ACCEL * dtSec);
        p.y -= v * dtSec;
        p.x += inp.moveX * v * 0.32 * dtSec;
      } else {
        v = Math.max(0, v - RLGL_DECEL * dtSec);
        if (v > 8) {
          p.y -= v * dtSec * 0.35;
        }
      }
    } else {
      v = Math.max(0, v - RLGL_DECEL * dtSec * 2.5);
      if (phase === "RED" || phase === "TURNING") {
        const snap = snapshots.get(sessionId);
        if (snap) {
          const dist = Math.hypot(p.x - snap.x, p.y - snap.y);
          if (dist > RLGL_MOVE_TOLERANCE) {
            eliminatePlayer(p, nowMs);
            return;
          }
        }
        if (phase === "RED" && wantsForward) {
          eliminatePlayer(p, nowMs);
          return;
        }
      }
    }

    velocities.set(sessionId, v);

    p.x = Math.max(-halfW, Math.min(halfW, p.x));
    p.y = Math.min(RLGL_START_Y + 40, p.y);

    if (p.y <= RLGL_FINISH_Y + 20) {
      finishOrder += 1;
      p.alive = false;
      p.placement = finishOrder;
      p.deathAt = nowMs;
    }
  });
}

function eliminatePlayer(p: Player, nowMs: number) {
  p.alive = false;
  p.deathAt = nowMs;
}

function countFinished(state: RedLightState): number {
  let n = 0;
  state.players.forEach((p) => {
    if (p.placement > 0) n++;
  });
  return n;
}

export function assignFinalPlacements(state: RedLightState) {
  const finished: Player[] = [];
  const eliminated: Player[] = [];
  state.players.forEach((p) => {
    if (p.placement > 0) finished.push(p);
    else if (!p.alive) eliminated.push(p);
    else eliminated.push(p);
  });

  finished.sort((a, b) => a.placement - b.placement);

  eliminated.sort((a, b) => a.y - b.y);
  let next = finished.length;
  for (const p of eliminated) {
    next += 1;
    p.placement = next;
    if (p.alive) {
      p.alive = false;
      p.deathAt = p.deathAt || Date.now();
    }
  }
}

export function pickSpawnSlot(index: number, total: number): { x: number; y: number } {
  const cols = Math.min(14, Math.max(8, Math.ceil(Math.sqrt(total))));
  const row = Math.floor(index / cols);
  const col = index % cols;
  const xSpan = RLGL_TRACK_WIDTH * 0.82;
  const xStep = cols > 1 ? xSpan / (cols - 1) : 0;
  const x = -xSpan / 2 + col * xStep;
  const y = RLGL_START_Y + row * 32;
  return { x, y };
}
