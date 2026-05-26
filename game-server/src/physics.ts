import {
  WORLD_HALF,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  BULLET_SPEED,
  BULLET_RADIUS,
  BULLET_TTL_SEC,
  BULLET_DAMAGE,
  SHOT_COOLDOWN_MS,
  ZONE_START_RADIUS,
  ZONE_END_RADIUS,
  ZONE_DPS_START,
  ZONE_DPS_END,
} from "./constants";
import type { SurvivorState, Player, Bullet } from "./state";
import { Bullet as BulletCtor } from "./state";

/** Latest input held server-side per player. Stored in a plain Map (NOT
 * Schema) because we never broadcast it to clients. */
export interface PlayerInput {
  /** Normalized -1..1; client sends raw axis, server clamps. */
  moveX: number;
  moveY: number;
  /** Radians. */
  aim: number;
  /** True if the player is currently holding fire (mouse button down). */
  shooting: boolean;
}

export function emptyInput(): PlayerInput {
  return { moveX: 0, moveY: 0, aim: 0, shooting: false };
}

export function sanitizeInput(raw: unknown): PlayerInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const moveX = clamp(Number(r.moveX) || 0, -1, 1);
  const moveY = clamp(Number(r.moveY) || 0, -1, 1);
  const aim = Number(r.aim);
  if (!Number.isFinite(aim)) return null;
  const shooting = !!r.shooting;

  // Renormalize joystick-style input so diagonals don't outrun cardinals.
  const mag = Math.hypot(moveX, moveY);
  if (mag > 1) {
    return { moveX: moveX / mag, moveY: moveY / mag, aim, shooting };
  }
  return { moveX, moveY, aim, shooting };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Advance every alive player by their latest input. */
export function tickPlayers(
  state: SurvivorState,
  inputs: Map<string, PlayerInput>,
  dtSec: number
): void {
  state.players.forEach((p, sessionId) => {
    if (!p.alive) return;
    const inp = inputs.get(sessionId);
    if (!inp) return;

    p.aim = inp.aim;
    const dx = inp.moveX * PLAYER_SPEED * dtSec;
    const dy = inp.moveY * PLAYER_SPEED * dtSec;
    p.x = clamp(p.x + dx, -WORLD_HALF + PLAYER_RADIUS, WORLD_HALF - PLAYER_RADIUS);
    p.y = clamp(p.y + dy, -WORLD_HALF + PLAYER_RADIUS, WORLD_HALF - PLAYER_RADIUS);
  });
}

/**
 * For every alive player whose input has shooting=true and cooldown expired,
 * spawn a bullet. Returns the number of bullets spawned (mostly for tests).
 */
export function tickShooting(
  state: SurvivorState,
  inputs: Map<string, PlayerInput>,
  nowMs: number
): number {
  let spawned = 0;
  state.players.forEach((p, sessionId) => {
    if (!p.alive) return;
    const inp = inputs.get(sessionId);
    if (!inp?.shooting) return;
    if (nowMs - p.lastShotAt < SHOT_COOLDOWN_MS) return;

    const b = new BulletCtor();
    b.ownerId = sessionId;
    b.x = p.x + Math.cos(p.aim) * (PLAYER_RADIUS + 2);
    b.y = p.y + Math.sin(p.aim) * (PLAYER_RADIUS + 2);
    b.vx = Math.cos(p.aim) * BULLET_SPEED;
    b.vy = Math.sin(p.aim) * BULLET_SPEED;
    b.spawnedAt = nowMs;
    state.bullets.push(b);
    p.lastShotAt = nowMs;
    spawned++;
  });
  return spawned;
}

/**
 * Integrate bullets, kill stale ones, and resolve player hits. When a player
 * dies, their final stats are frozen but they stay in the state map as
 * spectators (placement is set at match end).
 */
export function tickBullets(
  state: SurvivorState,
  dtSec: number,
  nowMs: number
): void {
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i] as Bullet;
    b.x += b.vx * dtSec;
    b.y += b.vy * dtSec;

    if (nowMs - b.spawnedAt > BULLET_TTL_SEC * 1000) {
      state.bullets.splice(i, 1);
      continue;
    }
    if (
      b.x < -WORLD_HALF ||
      b.x > WORLD_HALF ||
      b.y < -WORLD_HALF ||
      b.y > WORLD_HALF
    ) {
      state.bullets.splice(i, 1);
      continue;
    }

    let hit = false;
    state.players.forEach((p, sessionId) => {
      if (hit || !p.alive) return;
      if (sessionId === b.ownerId) return;
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const r = PLAYER_RADIUS + BULLET_RADIUS;
      if (dx * dx + dy * dy <= r * r) {
        applyDamage(state, p, BULLET_DAMAGE, b.ownerId, nowMs);
        hit = true;
      }
    });
    if (hit) state.bullets.splice(i, 1);
  }
}

/** Hurt a player; if it kills them, credit the killer. */
function applyDamage(
  state: SurvivorState,
  victim: Player,
  amount: number,
  killerSessionId: string | null,
  nowMs: number
): void {
  if (!victim.alive) return;
  victim.hp = Math.max(0, victim.hp - amount);
  if (victim.hp > 0) return;
  victim.alive = false;
  victim.deathAt = nowMs;
  if (killerSessionId) {
    const killer = state.players.get(killerSessionId);
    // Self-damage from the zone passes killerSessionId=null, so a zone death
    // never credits the victim themselves.
    if (killer && killer !== victim && killer.alive) {
      killer.kills += 1;
    }
  }
}

/**
 * Update the zone radius for the current match clock and apply damage to
 * anyone standing outside it. Zone shrinks linearly from start to end radius
 * over the match length, and DPS ramps linearly too.
 */
export function tickZone(
  state: SurvivorState,
  dtSec: number,
  nowMs: number
): void {
  if (state.status !== "PLAYING") return;
  const total = state.matchEndsAtMs - state.startedAtMs;
  if (total <= 0) return;
  const elapsed = clamp(nowMs - state.startedAtMs, 0, total);
  const t = elapsed / total;

  state.zone.targetRadius =
    ZONE_START_RADIUS + (ZONE_END_RADIUS - ZONE_START_RADIUS) * t;
  // Tween current radius gently toward target so the visual is smooth rather
  // than a stepwise jump every tick.
  const lerp = Math.min(1, dtSec * 2);
  state.zone.radius += (state.zone.targetRadius - state.zone.radius) * lerp;

  const dps = ZONE_DPS_START + (ZONE_DPS_END - ZONE_DPS_START) * t;
  const dmg = dps * dtSec;
  state.players.forEach((p) => {
    if (!p.alive) return;
    const dx = p.x - state.zone.cx;
    const dy = p.y - state.zone.cy;
    if (Math.hypot(dx, dy) > state.zone.radius) {
      applyDamage(state, p, dmg, null, nowMs);
    }
  });
}
