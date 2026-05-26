/**
 * Tuning constants for the Survivor game server. Everything here is server-
 * authoritative — change the value, redeploy, and the new behavior takes
 * effect on the next match.
 */

// ---------- World ----------
export const WORLD_SIZE = 2800;
export const WORLD_HALF = WORLD_SIZE / 2;

// ---------- Tick ----------
/** Simulation runs at 30Hz; one tick every ~33ms. */
export const TICK_MS = 1000 / 30;

// ---------- Player ----------
export const PLAYER_RADIUS = 18;
export const PLAYER_MAX_HP = 100;
export const PLAYER_SPEED = 280; // units / sec

// ---------- Bullet (shared physics) ----------
export const BULLET_RADIUS = 4;
/** Default bullet TTL; sniper overrides. */
export const BULLET_TTL_SEC = 1.5;

// ---------- Weapon table ----------
/**
 * Source of truth for weapon stats. The client mirrors a tiny subset
 * (colour + name) but never trusts client-side damage/cooldown.
 *
 * - cooldownMs: minimum gap between shots.
 * - bulletSpeed: world units / sec.
 * - damage: per-pellet, applied to first player hit.
 * - pellets: number of bullets spawned per fire event.
 * - spreadRad: half-angle of cone (radians). Pellets are evenly distributed
 *   across `-spreadRad..+spreadRad` around `aim`.
 * - ttlSec: bullet lifetime (overrides BULLET_TTL_SEC when set).
 */
export type WeaponKind = "pistol" | "shotgun" | "rapid" | "sniper";

export interface WeaponSpec {
  cooldownMs: number;
  bulletSpeed: number;
  damage: number;
  pellets: number;
  /** Total cone width in radians; pellets distributed across it. */
  spreadRad: number;
  ttlSec: number;
}

export const WEAPONS: Record<WeaponKind, WeaponSpec> = {
  pistol: {
    cooldownMs: 400,
    bulletSpeed: 800,
    damage: 25,
    pellets: 1,
    spreadRad: 0,
    ttlSec: 1.5,
  },
  shotgun: {
    cooldownMs: 650,
    bulletSpeed: 700,
    damage: 18,
    pellets: 3,
    spreadRad: (18 * Math.PI) / 180,
    ttlSec: 0.9,
  },
  rapid: {
    cooldownMs: 140,
    bulletSpeed: 900,
    damage: 10,
    pellets: 1,
    spreadRad: 0,
    ttlSec: 1.2,
  },
  sniper: {
    cooldownMs: 1100,
    bulletSpeed: 1400,
    damage: 65,
    pellets: 1,
    spreadRad: 0,
    ttlSec: 2.2,
  },
};

/** A weapon pickup grants its weapon for this many ms before reverting to pistol. */
export const WEAPON_BUFF_MS = 20_000;

// ---------- Pickups ----------
export const PICKUP_RADIUS = 14;
/** Average spawn interval in ms; jittered ±25% on each tick check. */
export const PICKUP_SPAWN_INTERVAL_MS = 5_000;
/** A pickup vanishes if uncollected this long. */
export const PICKUP_TTL_MS = 25_000;
/** Hard cap on concurrent map pickups. */
export const PICKUP_MAX_ACTIVE = 14;
/** Inset from current zone radius so pickups don't spawn on the deadly edge. */
export const PICKUP_ZONE_MARGIN = 120;
/** Health pack restore amount, capped at PLAYER_MAX_HP. */
export const HEALTH_PACK_AMOUNT = 50;

/**
 * Roulette weights. Healing should be common; sniper should be rare since
 * it's the most powerful.
 */
export const PICKUP_WEIGHTS: { kind: "health" | WeaponKind; weight: number }[] = [
  { kind: "health", weight: 30 },
  { kind: "shotgun", weight: 25 },
  { kind: "rapid", weight: 25 },
  { kind: "sniper", weight: 20 },
];

// ---------- Obstacles ----------
/**
 * Two-pass layout: first we lay down `WALL_CLUSTER_COUNT` wall clusters
 * (chains of 2-4 thick "wall" segments, sometimes with an L-bend), then we
 * scatter `STANDALONE_OBSTACLE_COUNT` crates/blocks/pallets in the gaps.
 * The result is maze-like (corridors and corners to break sightlines) while
 * still leaving plenty of open ground for movement.
 *
 * Players are clamped out, bullets stop on hit (swept collision), and
 * pickups + spawns reject obstacle interiors.
 */
export const WALL_CLUSTER_COUNT = 9;
export const STANDALONE_OBSTACLE_COUNT = 12;
/** Each wall segment is roughly this long; thickness is fixed at 46. */
export const WALL_SEGMENT_LEN = 110;
export const WALL_SEGMENT_THICKNESS = 46;
/** Min / max segments per wall cluster. */
export const WALL_SEG_MIN = 2;
export const WALL_SEG_MAX = 4;
/** Probability the wall bends 90deg partway through. */
export const WALL_BEND_PROB = 0.4;
/** Very small clear circle around origin so spawns near 0,0 have room. */
export const OBSTACLE_KEEP_OUT = 90;
/** Minimum gap (centre-to-centre) between any two obstacles in different clusters. */
export const OBSTACLE_MIN_SPACING = 140;
/** Inset from world edge so obstacles never clip the boundary. */
export const OBSTACLE_EDGE_INSET = 90;
/** How many random attempts per cluster / standalone before giving up. */
export const OBSTACLE_PLACEMENT_ATTEMPTS = 40;

export type ObstacleKind = "wall" | "crate" | "pallet" | "block";

export const OBSTACLE_SIZES: Record<ObstacleKind, Array<{ w: number; h: number }>> = {
  // Wall segments — generated in code, not sampled from this table, but kept
  // here so the type stays consistent. Client uses this kind to pick a
  // concrete-wall visual instead of stencil crate.
  wall: [
    { w: WALL_SEGMENT_LEN, h: WALL_SEGMENT_THICKNESS },
    { w: WALL_SEGMENT_THICKNESS, h: WALL_SEGMENT_LEN },
  ],
  // ~square shipping crates
  crate: [
    { w: 80, h: 80 },
    { w: 100, h: 100 },
    { w: 70, h: 70 },
  ],
  // Long flat pallets (random orientation chosen at gen time)
  pallet: [
    { w: 180, h: 60 },
    { w: 60, h: 180 },
    { w: 220, h: 70 },
    { w: 70, h: 220 },
  ],
  // Small low-profile blocks
  block: [
    { w: 55, h: 55 },
    { w: 50, h: 50 },
  ],
};

// ---------- Zone ----------
export const ZONE_START_RADIUS = 1900;
export const ZONE_END_RADIUS = 320;
/** Damage per second when outside the safe zone. Ramps up over the match. */
export const ZONE_DPS_START = 6;
export const ZONE_DPS_END = 30;

// ---------- Match ----------
/** Default match length in seconds; overridable by admin start payload. */
export const DEFAULT_MATCH_SECONDS = 420;
/** Default lobby seconds (between admin-start and PLAYING). Players who join
 *  during this window spawn as active; admin can override per-match. */
export const DEFAULT_LOBBY_SECONDS = 60;
export const MAX_PLAYERS = 25;

// ---------- Anti-cheat ----------
/** Max input messages per second; anything above is dropped silently. */
export const MAX_INPUTS_PER_SEC = 60;
