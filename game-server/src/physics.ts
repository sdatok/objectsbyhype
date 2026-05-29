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
  MYSTERY_PICKUP_KIND,
  POWERUP_LABELS,
  POWERUP_BLURBS,
  METEOR_EVENT_INTERVAL_MS,
  METEOR_WARNING_MS,
  METEOR_STRIKE_MIN,
  METEOR_STRIKE_MAX,
  METEOR_IMPACT_RADIUS,
  METEOR_IMPACT_DAMAGE,
  METEOR_STRIKE_STAGGER_MS,
  METEOR_CRATER_LINGER_MS,
  METEOR_CRATER_DPS,
  VOLCANO_LAVA_RADIUS,
  VOLCANO_DPS,
  VOLCANO_BURN_MS,
  DEFAULT_WEAPON,
  BURN_DURATION_MS,
  BURN_DPS,
  FREEZE_DURATION_MS,
  FREEZE_SLOW_SCALE,
  TOWER_WEAPON_CYCLE,
  OBSTACLE_KEEP_OUT,
  OBSTACLE_MIN_SPACING,
  OBSTACLE_EDGE_INSET,
  OBSTACLE_PLACEMENT_ATTEMPTS,
  OBSTACLE_SIZES,
  CLIFF_CLUSTER_COUNT,
  MAZE_SPOKE_COUNT,
  FEATURE_PROP_COUNT,
  STANDALONE_OBSTACLE_COUNT,
  WALL_SEGMENT_LEN,
  WALL_SEGMENT_THICKNESS,
  WALL_SEG_MIN,
  WALL_SEG_MAX,
  WALL_BEND_PROB,
  TOWER_PLACEMENTS,
  TOWER_KINDS,
  TOWER_DISPLAY_NAMES,
  TOWER_CYCLE_MS,
  TOWER_BUFF_RADIUS,
  type WeaponKind,
  type ObstacleKind,
  type TowerKind,
  type TowerBonusKind,
} from "./constants";
import type {
  SurvivorState,
  Player,
  Bullet,
  Pickup,
  Obstacle,
} from "./state";
import {
  Bullet as BulletCtor,
  Pickup as PickupCtor,
  Obstacle as ObstacleCtor,
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
    label: string;
    blurb: string;
  }>;
  towerBonus: {
    vendorName: string;
    bonusKind: string;
    towerKind: string;
    endsAtMs: number;
  } | null;
  volcanoEruption: {
    message: string;
    strikes: Array<{
      x: number;
      y: number;
      radius: number;
      impactAtMs: number;
    }>;
  } | null;
  explosions: Array<{
    x: number;
    y: number;
    radius: number;
    kind: string;
  }>;
}

export function emptyEvents(): TickEvents {
  return {
    kills: [],
    pickupsCollected: [],
    towerBonus: null,
    volcanoEruption: null,
    explosions: [],
  };
}

function playerRadius(p: Player): number {
  const scale = typeof p.radiusScale === "number" && p.radiusScale > 0 ? p.radiusScale : 1;
  return PLAYER_RADIUS * scale;
}

function playerSpeed(p: Player, nowMs: number): number {
  let scale = typeof p.speedScale === "number" && p.speedScale > 0 ? p.speedScale : 1;
  if (p.frozenUntilMs > nowMs) scale *= FREEZE_SLOW_SCALE;
  return PLAYER_SPEED * scale;
}

function resetToDefaultLoadout(p: Player): void {
  p.weapon = DEFAULT_WEAPON;
  p.weaponExpiresAtMs = 0;
}

function resetTowerBuff(p: Player): void {
  p.radiusScale = 1;
  p.speedScale = 1;
  p.maxHp = PLAYER_MAX_HP;
  p.hp = Math.min(p.hp, p.maxHp);
  p.towerBuffExpiresAtMs = 0;
  p.towerBuffKind = "";
}

function expirePlayerBuffs(p: Player, nowMs: number): void {
  if (p.weaponExpiresAtMs > 0 && nowMs >= p.weaponExpiresAtMs) {
    resetToDefaultLoadout(p);
  }
  if (p.towerBuffExpiresAtMs > 0 && nowMs >= p.towerBuffExpiresAtMs) {
    resetTowerBuff(p);
  }
  if (p.burnUntilMs > 0 && nowMs >= p.burnUntilMs) {
    p.burnUntilMs = 0;
  }
  if (p.frozenUntilMs > 0 && nowMs >= p.frozenUntilMs) {
    p.frozenUntilMs = 0;
  }
}

function applyWeaponHitEffects(
  victim: Player,
  weaponKind: string,
  nowMs: number
): void {
  if (weaponKind === "flamethrower") {
    victim.burnUntilMs = nowMs + BURN_DURATION_MS;
  }
  if (weaponKind === "ice_bow") {
    victim.frozenUntilMs = nowMs + FREEZE_DURATION_MS;
  }
}

/** Burn DoT + debuff expiry. */
export function tickDebuffs(
  state: SurvivorState,
  dtSec: number,
  nowMs: number,
  events: TickEvents
): void {
  state.players.forEach((p, sessionId) => {
    if (!p.alive) return;
    if (p.burnUntilMs > nowMs) {
      applyDamage(state, p, sessionId, BURN_DPS * dtSec, null, nowMs, events);
    }
  });
}

/** Advance every alive player by their latest input. */
export function tickPlayers(
  state: SurvivorState,
  inputs: Map<string, PlayerInput>,
  dtSec: number,
  nowMs: number
): void {
  state.players.forEach((p, sessionId) => {
    if (!p.alive) return;
    const inp = inputs.get(sessionId);
    if (!inp) return;

    p.aim = inp.aim;
    const speed = playerSpeed(p, nowMs);
    const radius = playerRadius(p);
    const dx = inp.moveX * speed * dtSec;
    const dy = inp.moveY * speed * dtSec;

    // Apply movement on each axis separately so the player slides along
    // obstacle walls rather than getting stuck against a corner.
    p.x = clamp(
      p.x + dx,
      -WORLD_HALF + radius,
      WORLD_HALF - radius
    );
    resolvePlayerAgainstObstacles(p, state.obstacles, "x", radius);
    p.y = clamp(
      p.y + dy,
      -WORLD_HALF + radius,
      WORLD_HALF - radius
    );
    resolvePlayerAgainstObstacles(p, state.obstacles, "y", radius);
  });
}

/**
 * Push the player out of any overlapping obstacle along the specified axis.
 * We resolve one axis at a time so input on the other axis keeps moving the
 * player along the obstacle face (slide behaviour).
 */
function resolvePlayerAgainstObstacles(
  p: Player,
  obstacles: SurvivorState["obstacles"],
  axis: "x" | "y",
  radius = PLAYER_RADIUS
): void {
  obstacles.forEach((o) => {
    const left = o.x - o.w / 2 - radius;
    const right = o.x + o.w / 2 + radius;
    const top = o.y - o.h / 2 - radius;
    const bottom = o.y + o.h / 2 + radius;
    if (p.x <= left || p.x >= right || p.y <= top || p.y >= bottom) {
      return;
    }
    if (axis === "x") {
      // Push to the nearer horizontal edge.
      const toLeft = p.x - left;
      const toRight = right - p.x;
      p.x = toLeft < toRight ? left : right;
    } else {
      const toTop = p.y - top;
      const toBottom = bottom - p.y;
      p.y = toTop < toBottom ? top : bottom;
    }
  });
}

function pointInsideObstacle(x: number, y: number, o: Obstacle, pad = 0): boolean {
  return (
    x > o.x - o.w / 2 - pad &&
    x < o.x + o.w / 2 + pad &&
    y > o.y - o.h / 2 - pad &&
    y < o.y + o.h / 2 + pad
  );
}

/**
 * Swept point-vs-AABB collision: returns true if the bullet's path from
 * (prevX, prevY) to (curX, curY) crosses the obstacle's bounding box.
 * Uses Liang-Barsky clipping so even fast bullets that would tunnel through
 * thin walls in a single tick still register.
 */
function bulletPathHitsObstacle(
  prevX: number,
  prevY: number,
  curX: number,
  curY: number,
  o: Obstacle
): boolean {
  const minX = o.x - o.w / 2 - BULLET_RADIUS;
  const maxX = o.x + o.w / 2 + BULLET_RADIUS;
  const minY = o.y - o.h / 2 - BULLET_RADIUS;
  const maxY = o.y + o.h / 2 + BULLET_RADIUS;

  const dx = curX - prevX;
  const dy = curY - prevY;
  let tMin = 0;
  let tMax = 1;

  if (dx === 0) {
    if (prevX < minX || prevX > maxX) return false;
  } else {
    let t1 = (minX - prevX) / dx;
    let t2 = (maxX - prevX) / dx;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return false;
  }

  if (dy === 0) {
    if (prevY < minY || prevY > maxY) return false;
  } else {
    let t1 = (minY - prevY) / dy;
    let t2 = (maxY - prevY) / dy;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return false;
  }

  return true;
}

function getWeaponSpec(weapon: string) {
  return WEAPONS[
    (weapon as WeaponKind) in WEAPONS ? (weapon as WeaponKind) : DEFAULT_WEAPON
  ];
}

/** Expire weapon + tower personal buffs each tick. */
export function tickPlayerBuffs(state: SurvivorState, nowMs: number): void {
  state.players.forEach((p) => {
    if (!p.alive) return;
    expirePlayerBuffs(p, nowMs);
  });
}

/**
 * For every alive player whose input has shooting=true and cooldown expired,
 * spawn the weapon's pellet pattern. Temporary weapons revert to pistol when
 * weaponExpiresAtMs elapses.
 */
export function tickShooting(
  state: SurvivorState,
  inputs: Map<string, PlayerInput>,
  nowMs: number,
  _events: TickEvents
): number {
  let spawned = 0;
  state.players.forEach((p, sessionId) => {
    if (!p.alive) return;
    const inp = inputs.get(sessionId);
    if (!inp?.shooting) return;

    const spec = getWeaponSpec(p.weapon);
    if (nowMs - p.lastShotAt < spec.cooldownMs) return;

    const pellets = Math.max(1, spec.pellets);
    const atkR = playerRadius(p);
    const step = pellets > 1 ? spec.spreadRad / (pellets - 1) : 0;
    const base = pellets > 1 ? p.aim - spec.spreadRad / 2 : p.aim;

    for (let i = 0; i < pellets; i++) {
      const angle = base + step * i;
      const b = new BulletCtor();
      b.ownerId = sessionId;
      b.x = p.x + Math.cos(angle) * (atkR + 2);
      b.y = p.y + Math.sin(angle) * (atkR + 2);
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

function detonateRocket(
  state: SurvivorState,
  x: number,
  y: number,
  ownerId: string,
  nowMs: number,
  events: TickEvents
): void {
  const spec = WEAPONS.rocket;
  const radius = spec.explodeRadius ?? 130;
  const splash = spec.splashDamage ?? 34;

  events.explosions.push({ x, y, radius, kind: "rocket" });

  state.players.forEach((p, sessionId) => {
    if (!p.alive) return;
    if (sessionId === ownerId) return;
    const dist = Math.hypot(p.x - x, p.y - y);
    const hitR = radius + playerRadius(p);
    if (dist > hitR) return;
    const falloff = 1 - (dist / hitR) * 0.4;
    applyDamage(
      state,
      p,
      sessionId,
      splash * falloff,
      ownerId,
      nowMs,
      events
    );
  });
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
    const prevX = b.x;
    const prevY = b.y;
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

    // Obstacle hit (swept segment vs AABB so fast bullets don't tunnel
    // through thin walls in a single tick). Rockets explode; others vanish.
    let blocked = false;
    state.obstacles.forEach((o) => {
      if (blocked) return;
      if (bulletPathHitsObstacle(prevX, prevY, b.x, b.y, o)) blocked = true;
    });
    if (blocked) {
      if (b.kind === "rocket") {
        detonateRocket(state, b.x, b.y, b.ownerId, nowMs, events);
      }
      state.bullets.splice(i, 1);
      continue;
    }

    let hit = false;
    state.players.forEach((p, sessionId) => {
      if (hit || !p.alive) return;
      if (sessionId === b.ownerId) return;
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const r = playerRadius(p) + BULLET_RADIUS;
      if (dx * dx + dy * dy <= r * r) {
        if (b.kind === "rocket") {
          detonateRocket(state, b.x, b.y, b.ownerId, nowMs, events);
        } else {
          const spec = getWeaponSpec(b.kind || DEFAULT_WEAPON);
          applyDamage(state, p, sessionId, spec.damage, b.ownerId, nowMs, events);
          applyWeaponHitEffects(p, b.kind, nowMs);
        }
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
  state.zone.radius = state.zone.targetRadius;
  state.zoneShrink01 = t;

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
    const pos = randomPointInsideZone(state);
    if (pos) {
      const pu = new PickupCtor();
      pu.kind = MYSTERY_PICKUP_KIND;
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
      const r = playerRadius(p) + PICKUP_RADIUS;
      if (dx * dx + dy * dy <= r * r) {
        const resolved = rouletteKind();
        applyPickup(p, resolved, nowMs);
        consumedBy = sessionId;
        events.pickupsCollected.push({
          sessionId: consumedBy,
          kind: resolved,
          label: POWERUP_LABELS[resolved] ?? resolved,
          blurb:
            POWERUP_BLURBS[resolved] ??
            "Mystery power-up unlocked — good luck out there.",
        });
      }
    });
    if (consumedBy) {
      state.pickups.splice(i, 1);
    }
  }

  return { nextSpawnAtMs };
}

function applyPickup(p: Player, kind: string, nowMs: number): void {
  if (kind === "health") {
    const cap = p.maxHp > 0 ? p.maxHp : PLAYER_MAX_HP;
    p.hp = Math.min(cap, p.hp + HEALTH_PACK_AMOUNT);
    return;
  }
  if (kind in WEAPONS) {
    p.weapon = kind;
    p.weaponExpiresAtMs = nowMs + WEAPON_BUFF_MS;
  }
}

function pickTowerWeapon(bonusKind: string): WeaponKind {
  if ((bonusKind as WeaponKind) in WEAPONS) {
    return bonusKind as WeaponKind;
  }
  return TOWER_WEAPON_CYCLE[0] ?? DEFAULT_WEAPON;
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
  // Try a few samples; reject ones that land inside an obstacle so pickups
  // are always reachable. Falls back to the last sampled point.
  for (let attempt = 0; attempt < 10; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.sqrt(Math.random()) * r;
    const x = state.zone.cx + Math.cos(angle) * dist;
    const y = state.zone.cy + Math.sin(angle) * dist;
    let blocked = false;
    state.obstacles.forEach((o) => {
      if (blocked) return;
      if (pointInsideObstacle(x, y, o, PICKUP_RADIUS + 8)) blocked = true;
    });
    if (!blocked) return { x, y };
  }
  return null;
}

export function freshPickupCtx(): PickupTickContext {
  return { nextSpawnAtMs: 0 };
}

// ---------- Obstacle generation ----------

interface ObstacleRect {
  kind: ObstacleKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** AABB overlap test with an extra margin so obstacles don't kiss each other. */
function rectOverlap(a: ObstacleRect, b: ObstacleRect, margin: number): boolean {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 + margin &&
    Math.abs(a.y - b.y) < (a.h + b.h) / 2 + margin
  );
}

function withinWorld(r: ObstacleRect): boolean {
  return (
    Math.abs(r.x) + r.w / 2 < WORLD_HALF - OBSTACLE_EDGE_INSET &&
    Math.abs(r.y) + r.h / 2 < WORLD_HALF - OBSTACLE_EDGE_INSET
  );
}

/** Obstacle centre must sit on the current safe beach (shrinking zone). */
function withinPlayableZone(
  state: SurvivorState,
  r: ObstacleRect,
  margin = 0
): boolean {
  const halfDiag = Math.hypot(r.w, r.h) / 2 + margin;
  const zx = state.zone.cx ?? 0;
  const zy = state.zone.cy ?? 0;
  const limit = Math.max(120, state.zone.radius - OBSTACLE_EDGE_INSET);
  return Math.hypot(r.x - zx, r.y - zy) + halfDiag <= limit;
}

/**
 * Try to lay down a single wall cluster: a chain of 2-4 axis-aligned
 * segments, optionally with one 90° bend. Returns the segment list or null
 * if no valid placement was found.
 */
function generateWallCluster(
  state: SurvivorState,
  placed: ObstacleRect[]
): ObstacleRect[] | null {
  const xMax = WORLD_HALF - OBSTACLE_EDGE_INSET - WALL_SEGMENT_LEN;
  const yMax = WORLD_HALF - OBSTACLE_EDGE_INSET - WALL_SEGMENT_LEN;

  for (let attempt = 0; attempt < OBSTACLE_PLACEMENT_ATTEMPTS; attempt++) {
    // Anchor + initial axis.
    let cx = (Math.random() * 2 - 1) * xMax;
    let cy = (Math.random() * 2 - 1) * yMax;
    if (Math.hypot(cx, cy) < OBSTACLE_KEEP_OUT) continue;

    let horizontal = Math.random() < 0.5;
    const segCount =
      WALL_SEG_MIN + Math.floor(Math.random() * (WALL_SEG_MAX - WALL_SEG_MIN + 1));
    const bendAt =
      segCount >= 3 && Math.random() < WALL_BEND_PROB
        ? 1 + Math.floor(Math.random() * (segCount - 1))
        : -1;

    const segments: ObstacleRect[] = [];
    let ok = true;
    for (let s = 0; s < segCount; s++) {
      if (s === bendAt) {
        // Step off-axis by half a segment, then flip orientation so the
        // chain continues perpendicular to where it was going.
        if (horizontal) cy += (Math.random() < 0.5 ? 1 : -1) * WALL_SEGMENT_LEN / 2;
        else cx += (Math.random() < 0.5 ? 1 : -1) * WALL_SEGMENT_LEN / 2;
        horizontal = !horizontal;
      }
      const w = horizontal ? WALL_SEGMENT_LEN : WALL_SEGMENT_THICKNESS;
      const h = horizontal ? WALL_SEGMENT_THICKNESS : WALL_SEGMENT_LEN;
      const seg: ObstacleRect = { kind: "cliff", x: cx, y: cy, w, h };

      if (!withinWorld(seg) || !withinPlayableZone(state, seg, 8)) {
        ok = false;
        break;
      }
      // Reject if too close to any already-placed (different-cluster) rect.
      // Within-cluster segments are allowed to touch by design.
      for (const p of placed) {
        if (rectOverlap(seg, p, OBSTACLE_MIN_SPACING)) {
          ok = false;
          break;
        }
      }
      if (!ok) break;
      segments.push(seg);

      // Advance to next segment centre along the current axis.
      if (horizontal) cx += WALL_SEGMENT_LEN;
      else cy += WALL_SEGMENT_LEN;
    }
    if (ok && segments.length >= WALL_SEG_MIN) return segments;
  }
  return null;
}

function tryPlaceObstacle(
  state: SurvivorState,
  placed: ObstacleRect[],
  candidate: ObstacleRect
): boolean {
  if (!withinWorld(candidate) || !withinPlayableZone(state, candidate, 10)) {
    return false;
  }
  for (const p of placed) {
    if (rectOverlap(candidate, p, OBSTACLE_MIN_SPACING)) return false;
  }
  placed.push(candidate);
  return true;
}

/** Radial cliff spokes from the zone centre to carve maze corridors. */
function generateMazeSpokes(
  state: SurvivorState,
  placed: ObstacleRect[]
): void {
  const zr = state.zone.radius - OBSTACLE_EDGE_INSET * 2;
  for (let i = 0; i < MAZE_SPOKE_COUNT; i++) {
    const baseAngle = (i / MAZE_SPOKE_COUNT) * Math.PI * 2 + Math.random() * 0.15;
    const segCount = 2 + Math.floor(Math.random() * 3);
    for (let s = 0; s < segCount; s++) {
      const dist = OBSTACLE_KEEP_OUT + 120 + s * (WALL_SEGMENT_LEN * 0.95);
      if (dist > zr * 0.82) break;
      const x = Math.cos(baseAngle) * dist;
      const y = Math.sin(baseAngle) * dist;
      const along = baseAngle + Math.PI / 2;
      const w = WALL_SEGMENT_LEN;
      const h = WALL_SEGMENT_THICKNESS;
      const cx = x + Math.cos(along) * (s % 2 === 0 ? 0 : WALL_SEGMENT_LEN * 0.35);
      const cy = y + Math.sin(along) * (s % 2 === 0 ? 0 : WALL_SEGMENT_LEN * 0.35);
      tryPlaceObstacle(state, placed, {
        kind: "cliff",
        x: cx,
        y: cy,
        w,
        h,
      });
    }
  }
}

/** Place guaranteed gorilla + flower props (user-provided art). */
function generateFeatureProps(
  state: SurvivorState,
  placed: ObstacleRect[]
): void {
  const kinds: ObstacleKind[] = [
    "gorilla",
    "flower",
    "gorilla",
    "flower",
    "gorilla",
    "flower",
  ];
  let placedCount = 0;
  let attempts = FEATURE_PROP_COUNT * OBSTACLE_PLACEMENT_ATTEMPTS;
  while (placedCount < FEATURE_PROP_COUNT && attempts > 0) {
    attempts--;
    const kind = kinds[placedCount % kinds.length];
    const size = OBSTACLE_SIZES[kind][0];
    const angle = Math.random() * Math.PI * 2;
    const dist =
      OBSTACLE_KEEP_OUT +
      Math.random() * (state.zone.radius * 0.65 - OBSTACLE_KEEP_OUT);
    const candidate: ObstacleRect = {
      kind,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      w: size.w,
      h: size.h,
    };
    if (tryPlaceObstacle(state, placed, candidate)) placedCount++;
  }
}

/** One volcanic hazard per map — lava pool + meteor event anchor. */
function generateVolcano(
  state: SurvivorState,
  placed: ObstacleRect[]
): void {
  const size = OBSTACLE_SIZES.volcano[0];
  for (let attempt = 0; attempt < OBSTACLE_PLACEMENT_ATTEMPTS; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const dist =
      OBSTACLE_KEEP_OUT +
      180 +
      Math.random() * (state.zone.radius * 0.55 - OBSTACLE_KEEP_OUT);
    const candidate: ObstacleRect = {
      kind: "volcano",
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      w: size.w,
      h: size.h,
    };
    if (tryPlaceObstacle(state, placed, candidate)) return;
  }
}

/**
 * Generate a fresh obstacle layout for a new match and write it into
 * `state.obstacles`.
 *
 * Two-pass: wall clusters first (form corridors / cover lines), then
 * scattered standalone crates / pallets / blocks (fill in cover spots
 * between the walls). Uses rejection sampling against the world edge,
 * a tiny origin keep-out, and inter-cluster spacing.
 */
export function generateObstacles(state: SurvivorState): void {
  state.obstacles.clear();

  const placed: ObstacleRect[] = [];

  // ---- Pass 1: cliff / rock maze clusters ----
  for (let i = 0; i < CLIFF_CLUSTER_COUNT; i++) {
    const cluster = generateWallCluster(state, placed);
    if (!cluster) continue;
    for (const seg of cluster) placed.push(seg);
  }

  // ---- Pass 2: radial maze spokes ----
  generateMazeSpokes(state, placed);

  // ---- Pass 3: gorilla + flower feature props ----
  generateFeatureProps(state, placed);

  // ---- Pass 3b: volcano (lava hazard + meteor source) ----
  generateVolcano(state, placed);

  // ---- Pass 4: vendor towers (fixed scattered positions) ----
  generateVendorTowers(state, placed);

  // ---- Pass 5: standalone cover (palms, rocks, wreckage) ----
  const kindWeights: Array<{ kind: ObstacleKind; weight: number }> = [
    { kind: "palm", weight: 40 },
    { kind: "rock", weight: 30 },
    { kind: "wreck", weight: 20 },
    { kind: "gorilla", weight: 5 },
    { kind: "flower", weight: 5 },
  ];
  const totalWeight = kindWeights.reduce((s, k) => s + k.weight, 0);

  let placedStandalone = 0;
  let attemptsRemaining = STANDALONE_OBSTACLE_COUNT * OBSTACLE_PLACEMENT_ATTEMPTS;
  while (placedStandalone < STANDALONE_OBSTACLE_COUNT && attemptsRemaining > 0) {
    attemptsRemaining--;

    let r = Math.random() * totalWeight;
    let kind: ObstacleKind = "rock";
    for (const entry of kindWeights) {
      r -= entry.weight;
      if (r <= 0) {
        kind = entry.kind;
        break;
      }
    }
    const sizeChoices = OBSTACLE_SIZES[kind];
    const size = sizeChoices[Math.floor(Math.random() * sizeChoices.length)];

    const x = (Math.random() * 2 - 1) * (WORLD_HALF - OBSTACLE_EDGE_INSET);
    const y = (Math.random() * 2 - 1) * (WORLD_HALF - OBSTACLE_EDGE_INSET);
    if (Math.hypot(x, y) < OBSTACLE_KEEP_OUT) continue;

    const candidate: ObstacleRect = { kind, x, y, w: size.w, h: size.h };
    if (!withinWorld(candidate) || !withinPlayableZone(state, candidate, 12)) continue;

    let blocked = false;
    for (const p of placed) {
      if (rectOverlap(candidate, p, OBSTACLE_MIN_SPACING)) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    placed.push(candidate);
    placedStandalone++;
  }

  // ---- Flush into ArraySchema ----
  for (const p of placed) {
    const o = new ObstacleCtor();
    o.kind = p.kind;
    o.x = p.x;
    o.y = p.y;
    o.w = p.w;
    o.h = p.h;
    state.obstacles.push(o);
  }

  console.log(`[survivor] generateObstacles placed ${state.obstacles.length} segments`);
}

/** Place all vendor towers at hand-authored fixed positions. */
function generateVendorTowers(
  state: SurvivorState,
  placed: ObstacleRect[]
): void {
  for (const slot of TOWER_PLACEMENTS) {
    const size = OBSTACLE_SIZES[slot.kind][0];
    const candidate: ObstacleRect = {
      kind: slot.kind,
      x: slot.x,
      y: slot.y,
      w: size.w,
      h: size.h,
    };
    if (!withinWorld(candidate) || !withinPlayableZone(state, candidate, 12)) {
      console.warn(
        `[survivor] tower ${slot.kind} at (${slot.x},${slot.y}) may be out of bounds`
      );
    }
    placed.push(candidate);
  }
}

function findTowerObstacle(
  state: SurvivorState,
  kind: string
): Obstacle | null {
  for (let i = 0; i < state.obstacles.length; i++) {
    const o = state.obstacles[i] as Obstacle;
    if (o.kind === kind) return o;
  }
  return null;
}

function isInsideTowerZone(px: number, py: number, tower: Obstacle): boolean {
  const dx = px - tower.x;
  const dy = py - tower.y;
  return Math.hypot(dx, dy) <= TOWER_BUFF_RADIUS;
}

function pickNextTowerKind(cycleIndex: number): TowerKind {
  return TOWER_KINDS[cycleIndex % TOWER_KINDS.length];
}

function pickNextTowerWeapon(cycleIndex: number): WeaponKind {
  return TOWER_WEAPON_CYCLE[cycleIndex % TOWER_WEAPON_CYCLE.length];
}

function startTowerCycle(
  state: SurvivorState,
  nowMs: number,
  events: TickEvents
): void {
  const idx = Number.isFinite(state.towerCycleIndex) ? state.towerCycleIndex : 0;
  const towerKind = pickNextTowerKind(idx);
  const bonusKind = pickNextTowerWeapon(idx);

  state.activeTowerKind = towerKind;
  state.activeBonusKind = bonusKind;
  state.towerCycleEndsAtMs = nowMs + TOWER_CYCLE_MS;
  state.towerCycleIndex = idx + 1;

  events.towerBonus = {
    vendorName: TOWER_DISPLAY_NAMES[towerKind],
    bonusKind,
    towerKind,
    endsAtMs: state.towerCycleEndsAtMs,
  };
}

/**
 * Rotate which vendor tower is distributing weapons; players who enter the glow
 * ring during the cycle receive the featured gun (once per cycle).
 */
export function tickTowerBonuses(
  state: SurvivorState,
  _dtSec: number,
  nowMs: number,
  events: TickEvents
): void {
  if (state.status !== "PLAYING") return;

  if (!state.activeTowerKind || nowMs >= state.towerCycleEndsAtMs) {
    startTowerCycle(state, nowMs, events);
  }

  const tower = findTowerObstacle(state, state.activeTowerKind);
  if (!tower) return;

  const grantedWeapon = pickTowerWeapon(state.activeBonusKind);

  state.players.forEach((p) => {
    if (!p.alive) return;
    if (!isInsideTowerZone(p.x, p.y, tower)) return;
    if (p.gunGrantedCycleEndsAtMs === state.towerCycleEndsAtMs) return;

    p.weapon = grantedWeapon;
    p.weaponExpiresAtMs = nowMs + WEAPON_BUFF_MS;
    p.gunGrantedCycleEndsAtMs = state.towerCycleEndsAtMs;
  });
}

// ---------- Volcano lava + meteor showers ----------

export interface MeteorTickContext {
  nextEventAtMs: number;
  pendingStrikes: Array<{
    x: number;
    y: number;
    radius: number;
    impactAtMs: number;
  }>;
  activeCraters: Array<{
    x: number;
    y: number;
    radius: number;
    expiresAtMs: number;
  }>;
}

export function freshMeteorCtx(matchStartedAtMs = 0): MeteorTickContext {
  return {
    nextEventAtMs:
      matchStartedAtMs > 0
        ? matchStartedAtMs + METEOR_EVENT_INTERVAL_MS
        : 0,
    pendingStrikes: [],
    activeCraters: [],
  };
}

function findVolcanoObstacle(state: SurvivorState): Obstacle | null {
  for (let i = 0; i < state.obstacles.length; i++) {
    const o = state.obstacles[i] as Obstacle;
    if (o.kind === "volcano") return o;
  }
  return null;
}

function tickVolcanoLava(
  state: SurvivorState,
  dtSec: number,
  nowMs: number,
  events: TickEvents
): void {
  const volcano = findVolcanoObstacle(state);
  if (!volcano) return;

  const lavaX = volcano.x;
  const lavaY = volcano.y + volcano.h * 0.12;
  const lavaR = VOLCANO_LAVA_RADIUS;

  state.players.forEach((p, sessionId) => {
    if (!p.alive) return;
    const r = playerRadius(p);
    const dx = p.x - lavaX;
    const dy = p.y - lavaY;
    const limit = lavaR + r;
    if (dx * dx + dy * dy > limit * limit) return;
    applyDamage(state, p, sessionId, VOLCANO_DPS * dtSec, null, nowMs, events);
    p.burnUntilMs = Math.max(p.burnUntilMs, nowMs + VOLCANO_BURN_MS);
  });
}

function tickMeteorCraters(
  state: SurvivorState,
  ctx: MeteorTickContext,
  dtSec: number,
  nowMs: number,
  events: TickEvents
): void {
  ctx.activeCraters = ctx.activeCraters.filter((c) => c.expiresAtMs > nowMs);
  for (const crater of ctx.activeCraters) {
    state.players.forEach((p, sessionId) => {
      if (!p.alive) return;
      const r = playerRadius(p);
      const dx = p.x - crater.x;
      const dy = p.y - crater.y;
      const limit = crater.radius * 0.85 + r;
      if (dx * dx + dy * dy > limit * limit) return;
      applyDamage(
        state,
        p,
        sessionId,
        METEOR_CRATER_DPS * dtSec,
        null,
        nowMs,
        events
      );
      p.burnUntilMs = Math.max(p.burnUntilMs, nowMs + 600);
    });
  }
}

function resolveMeteorStrike(
  state: SurvivorState,
  strike: MeteorTickContext["pendingStrikes"][number],
  nowMs: number,
  events: TickEvents
): void {
  state.players.forEach((p, sessionId) => {
    if (!p.alive) return;
    const r = playerRadius(p);
    const dx = p.x - strike.x;
    const dy = p.y - strike.y;
    const limit = strike.radius + r;
    if (dx * dx + dy * dy > limit * limit) return;
    const dist = Math.hypot(dx, dy);
    const falloff = 1 - dist / Math.max(1, limit);
    applyDamage(
      state,
      p,
      sessionId,
      METEOR_IMPACT_DAMAGE * Math.max(0.25, falloff),
      null,
      nowMs,
      events
    );
    p.burnUntilMs = Math.max(p.burnUntilMs, nowMs + BURN_DURATION_MS);
  });

  events.explosions.push({
    x: strike.x,
    y: strike.y,
    radius: strike.radius,
    kind: "meteor",
  });
}

function scheduleMeteorShower(
  state: SurvivorState,
  nowMs: number,
  events: TickEvents,
  ctx: MeteorTickContext
): void {
  const count =
    METEOR_STRIKE_MIN +
    Math.floor(Math.random() * (METEOR_STRIKE_MAX - METEOR_STRIKE_MIN + 1));
  const strikes: MeteorTickContext["pendingStrikes"] = [];

  for (let i = 0; i < count; i++) {
    const pos = randomPointInsideZone(state);
    if (!pos) continue;
    strikes.push({
      x: pos.x,
      y: pos.y,
      radius: METEOR_IMPACT_RADIUS * (0.85 + Math.random() * 0.3),
      impactAtMs:
        nowMs + METEOR_WARNING_MS + i * METEOR_STRIKE_STAGGER_MS,
    });
  }

  if (strikes.length === 0) return;

  ctx.pendingStrikes.push(...strikes);
  ctx.nextEventAtMs = nowMs + METEOR_EVENT_INTERVAL_MS;
  events.volcanoEruption = {
    message: "The volcano is erupting!",
    strikes: strikes.map((s) => ({ ...s })),
  };
}

/** Volcano lava DoT + periodic meteor showers across the island. */
export function tickMeteorVolcano(
  state: SurvivorState,
  ctx: MeteorTickContext,
  dtSec: number,
  nowMs: number,
  events: TickEvents
): MeteorTickContext {
  if (state.status !== "PLAYING") return ctx;

  tickVolcanoLava(state, dtSec, nowMs, events);
  tickMeteorCraters(state, ctx, dtSec, nowMs, events);

  const remaining: MeteorTickContext["pendingStrikes"] = [];
  for (const strike of ctx.pendingStrikes) {
    if (nowMs >= strike.impactAtMs) {
      resolveMeteorStrike(state, strike, nowMs, events);
      ctx.activeCraters.push({
        x: strike.x,
        y: strike.y,
        radius: strike.radius,
        expiresAtMs: nowMs + METEOR_CRATER_LINGER_MS,
      });
    } else {
      remaining.push(strike);
    }
  }
  ctx.pendingStrikes = remaining;

  if (ctx.nextEventAtMs > 0 && nowMs >= ctx.nextEventAtMs) {
    scheduleMeteorShower(state, nowMs, events, ctx);
  }

  return ctx;
}
