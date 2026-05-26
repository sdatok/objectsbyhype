import {
  WORLD_HALF,
  PLAYER_RADIUS,
  PLAYER_MAX_HP,
  PLAYER_SPEED,
  BULLET_RADIUS,
  ZONE_START_RADIUS,
  ZONE_END_RADIUS,
  ZONE_DPS_START,
  ZONE_DPS_END,
  WEAPONS,
  WEAPON_BUFF_MS,
  PICKUP_RADIUS,
  PICKUP_SPAWN_INTERVAL_MS,
  PICKUP_TTL_MS,
  PICKUP_MAX_ACTIVE,
  PICKUP_ZONE_MARGIN,
  PICKUP_WEIGHTS,
  HEALTH_PACK_AMOUNT,
  type WeaponKind,
} from "./constants";
import type { SurvivorState, Player, Bullet, Pickup } from "./state";
import {
  Bullet as BulletCtor,
  Pickup as PickupCtor,
} from "./state";

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

/**
 * Server-side notification surface for one-off events. The room collects
 * these every tick and forwards them as out-of-band `room.send` messages so
 * clients can fire UI toasts (pickup acquired, kill, etc.) without waiting
 * for a schema sync.
 */
export interface TickEvents {
  kills: Array<{
    killerSessionId: string;
    killerName: string;
    victimSessionId: string;
    victimName: string;
  }>;
  pickupsCollected: Array<{
    sessionId: string;
    kind: string;
  }>;
}

export function emptyEvents(): TickEvents {
  return { kills: [], pickupsCollected: [] };
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

function getWeaponSpec(weapon: string) {
  return WEAPONS[(weapon as WeaponKind) in WEAPONS ? (weapon as WeaponKind) : "pistol"];
}

/**
 * For every alive player whose input has shooting=true and cooldown expired,
 * spawn the weapon's pellet pattern. Also revives players whose weapon-buff
 * has timed out back to the default pistol.
 */
export function tickShooting(
  state: SurvivorState,
  inputs: Map<string, PlayerInput>,
  nowMs: number
): number {
  let spawned = 0;
  state.players.forEach((p, sessionId) => {
    // Expire any active weapon buff first so cooldown/spread reverts cleanly.
    if (p.weaponExpiresAtMs > 0 && nowMs >= p.weaponExpiresAtMs) {
      p.weapon = "pistol";
      p.weaponExpiresAtMs = 0;
    }
    if (!p.alive) return;
    const inp = inputs.get(sessionId);
    if (!inp?.shooting) return;
    const spec = getWeaponSpec(p.weapon);
    if (nowMs - p.lastShotAt < spec.cooldownMs) return;

    const pellets = Math.max(1, spec.pellets);
    // For an odd pellet count, the middle bullet flies straight; for even
    // counts the cone is symmetric around `aim`. spreadRad is the TOTAL
    // cone width — bullets are evenly distributed across it.
    const step = pellets > 1 ? spec.spreadRad / (pellets - 1) : 0;
    const base = pellets > 1 ? p.aim - spec.spreadRad / 2 : p.aim;

    for (let i = 0; i < pellets; i++) {
      const angle = base + step * i;
      const b = new BulletCtor();
      b.ownerId = sessionId;
      b.x = p.x + Math.cos(angle) * (PLAYER_RADIUS + 2);
      b.y = p.y + Math.sin(angle) * (PLAYER_RADIUS + 2);
      b.vx = Math.cos(angle) * spec.bulletSpeed;
      b.vy = Math.sin(angle) * spec.bulletSpeed;
      b.spawnedAt = nowMs;
      b.ttlMs = Math.round(spec.ttlSec * 1000);
      b.kind = p.weapon;
      state.bullets.push(b);
      spawned++;
    }
    p.lastShotAt = nowMs;
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
  nowMs: number,
  events: TickEvents
): void {
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i] as Bullet;
    b.x += b.vx * dtSec;
    b.y += b.vy * dtSec;

    const ttlMs = b.ttlMs > 0 ? b.ttlMs : 1500;
    if (nowMs - b.spawnedAt > ttlMs) {
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
        const spec = getWeaponSpec(b.kind || "pistol");
        applyDamage(state, p, sessionId, spec.damage, b.ownerId, nowMs, events);
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
  victimSessionId: string,
  amount: number,
  killerSessionId: string | null,
  nowMs: number,
  events: TickEvents
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
      events.kills.push({
        killerSessionId,
        killerName: killer.displayName,
        victimSessionId,
        victimName: victim.displayName,
      });
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
  nowMs: number,
  events: TickEvents
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
  state.players.forEach((p, sessionId) => {
    if (!p.alive) return;
    const dx = p.x - state.zone.cx;
    const dy = p.y - state.zone.cy;
    if (Math.hypot(dx, dy) > state.zone.radius) {
      applyDamage(state, p, sessionId, dmg, null, nowMs, events);
    }
  });
}

// ---------- Pickups ----------

interface PickupTickContext {
  /** When the next pickup may spawn. We initialise this once and let the
   *  caller persist it on the room. */
  nextSpawnAtMs: number;
}

/**
 * Spawn pickups on a jittered interval, despawn old ones, and resolve
 * player-pickup collisions. Returns a (possibly mutated) context so the
 * caller can persist `nextSpawnAtMs` across ticks.
 */
export function tickPickups(
  state: SurvivorState,
  ctx: PickupTickContext,
  nowMs: number,
  events: TickEvents
): PickupTickContext {
  if (state.status !== "PLAYING") return ctx;

  // Expire stale pickups.
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pu = state.pickups[i] as Pickup;
    if (nowMs - pu.spawnedAt > PICKUP_TTL_MS) {
      state.pickups.splice(i, 1);
    }
  }

  // Spawn one new pickup if interval elapsed and we're under the cap.
  let nextSpawnAtMs = ctx.nextSpawnAtMs;
  if (
    nowMs >= nextSpawnAtMs &&
    state.pickups.length < PICKUP_MAX_ACTIVE
  ) {
    const kind = rouletteKind();
    const pos = randomPointInsideZone(state);
    if (pos) {
      const pu = new PickupCtor();
      pu.kind = kind;
      pu.x = pos.x;
      pu.y = pos.y;
      pu.spawnedAt = nowMs;
      state.pickups.push(pu);
    }
    // Jitter the next spawn by ±25% so the timing isn't metronome-perfect.
    const jitter = (Math.random() - 0.5) * 0.5;
    nextSpawnAtMs =
      nowMs + Math.floor(PICKUP_SPAWN_INTERVAL_MS * (1 + jitter));
  }

  // Pickup collisions.
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pu = state.pickups[i] as Pickup;
    let consumedBy: string | null = null;
    state.players.forEach((p, sessionId) => {
      if (consumedBy || !p.alive) return;
      const dx = p.x - pu.x;
      const dy = p.y - pu.y;
      const r = PLAYER_RADIUS + PICKUP_RADIUS;
      if (dx * dx + dy * dy <= r * r) {
        applyPickup(p, pu.kind, nowMs);
        consumedBy = sessionId;
      }
    });
    if (consumedBy) {
      events.pickupsCollected.push({ sessionId: consumedBy, kind: pu.kind });
      state.pickups.splice(i, 1);
    }
  }

  return { nextSpawnAtMs };
}

function applyPickup(p: Player, kind: string, nowMs: number): void {
  if (kind === "health") {
    p.hp = Math.min(PLAYER_MAX_HP, p.hp + HEALTH_PACK_AMOUNT);
    return;
  }
  if (kind in WEAPONS) {
    p.weapon = kind;
    p.weaponExpiresAtMs = nowMs + WEAPON_BUFF_MS;
  }
}

function rouletteKind(): string {
  const total = PICKUP_WEIGHTS.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const entry of PICKUP_WEIGHTS) {
    r -= entry.weight;
    if (r <= 0) return entry.kind;
  }
  return PICKUP_WEIGHTS[0].kind;
}

function randomPointInsideZone(
  state: SurvivorState
): { x: number; y: number } | null {
  const r = Math.max(40, state.zone.radius - PICKUP_ZONE_MARGIN);
  if (r <= 0) return null;
  // Uniform disc sample around the zone centre.
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.sqrt(Math.random()) * r;
  return {
    x: state.zone.cx + Math.cos(angle) * dist,
    y: state.zone.cy + Math.sin(angle) * dist,
  };
}

export function freshPickupCtx(): PickupTickContext {
  return { nextSpawnAtMs: 0 };
}
