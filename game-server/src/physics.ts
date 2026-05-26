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
  OBSTACLE_KEEP_OUT,
  OBSTACLE_MIN_SPACING,
  OBSTACLE_EDGE_INSET,
  OBSTACLE_PLACEMENT_ATTEMPTS,
  OBSTACLE_SIZES,
  CLIFF_CLUSTER_COUNT,
  STANDALONE_OBSTACLE_COUNT,
  ISLAND_RADIUS,
  WALL_SEGMENT_LEN,
  WALL_SEGMENT_THICKNESS,
  WALL_SEG_MIN,
  WALL_SEG_MAX,
  WALL_BEND_PROB,
  type WeaponKind,
  type ObstacleKind,
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

    // Apply movement on each axis separately so the player slides along
    // obstacle walls rather than getting stuck against a corner.
    p.x = clamp(
      p.x + dx,
      -WORLD_HALF + PLAYER_RADIUS,
      WORLD_HALF - PLAYER_RADIUS
    );
    resolvePlayerAgainstObstacles(p, state.obstacles, "x");
    p.y = clamp(
      p.y + dy,
      -WORLD_HALF + PLAYER_RADIUS,
      WORLD_HALF - PLAYER_RADIUS
    );
    resolvePlayerAgainstObstacles(p, state.obstacles, "y");
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
  axis: "x" | "y"
): void {
  obstacles.forEach((o) => {
    const left = o.x - o.w / 2 - PLAYER_RADIUS;
    const right = o.x + o.w / 2 + PLAYER_RADIUS;
    const top = o.y - o.h / 2 - PLAYER_RADIUS;
    const bottom = o.y + o.h / 2 + PLAYER_RADIUS;
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
    // through thin walls in a single tick). Bullet is absorbed, no damage.
    let blocked = false;
    state.obstacles.forEach((o) => {
      if (blocked) return;
      if (bulletPathHitsObstacle(prevX, prevY, b.x, b.y, o)) blocked = true;
    });
    if (blocked) {
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

/** Obstacle centre + half-size must sit on the sand disc, not in the water. */
function withinIsland(r: ObstacleRect, margin = 0): boolean {
  const halfDiag = Math.hypot(r.w, r.h) / 2 + margin;
  return Math.hypot(r.x, r.y) + halfDiag <= ISLAND_RADIUS - OBSTACLE_EDGE_INSET;
}

/**
 * Try to lay down a single wall cluster: a chain of 2-4 axis-aligned
 * segments, optionally with one 90° bend. Returns the segment list or null
 * if no valid placement was found.
 */
function generateWallCluster(placed: ObstacleRect[]): ObstacleRect[] | null {
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

      if (!withinWorld(seg) || !withinIsland(seg, 8)) {
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
    const cluster = generateWallCluster(placed);
    if (!cluster) continue;
    for (const seg of cluster) placed.push(seg);
  }

  // ---- Pass 2: standalone cover ----
  const kindWeights: Array<{ kind: ObstacleKind; weight: number }> = [
    { kind: "palm", weight: 35 },
    { kind: "rock", weight: 35 },
    { kind: "wreck", weight: 30 },
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
    if (!withinWorld(candidate) || !withinIsland(candidate, 12)) continue;

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
