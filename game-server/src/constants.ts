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

// ---------- Island / obstacles ----------
/** Circular playable sand area (world centre). Obstacles spawn inside this. */
export const ISLAND_RADIUS = 1320;
/** Beach ring width at the island edge (visual + spawn padding). */
export const ISLAND_BEACH_WIDTH = 80;

/**
 * Two-pass island layout: cliff/rock maze clusters + scattered palms,
 * boulders, and wreckage. Everything spawns on the sand disc, not in the
 * surrounding water.
 */
export const CLIFF_CLUSTER_COUNT = 18;
export const STANDALONE_OBSTACLE_COUNT = 28;
/** Radial maze spokes (cliff segments from centre outward). */
export const MAZE_SPOKE_COUNT = 8;
/** How many guaranteed gorilla + flower statue props per match. */
export const FEATURE_PROP_COUNT = 6;
export const WALL_SEGMENT_LEN = 100;
export const WALL_SEGMENT_THICKNESS = 42;
export const WALL_SEG_MIN = 3;
export const WALL_SEG_MAX = 5;
export const WALL_BEND_PROB = 0.55;
export const OBSTACLE_KEEP_OUT = 70;
export const OBSTACLE_MIN_SPACING = 85;
export const OBSTACLE_EDGE_INSET = 50;
export const OBSTACLE_PLACEMENT_ATTEMPTS = 60;

export type ObstacleKind = "cliff" | "rock" | "palm" | "wreck" | "gorilla" | "flower";

export const OBSTACLE_SIZES: Record<ObstacleKind, Array<{ w: number; h: number }>> = {
  cliff: [
    { w: WALL_SEGMENT_LEN, h: WALL_SEGMENT_THICKNESS },
    { w: WALL_SEGMENT_THICKNESS, h: WALL_SEGMENT_LEN },
  ],
  rock: [
    { w: 64, h: 52 },
    { w: 48, h: 48 },
    { w: 78, h: 62 },
  ],
  palm: [
    { w: 36, h: 36 },
    { w: 44, h: 44 },
  ],
  wreck: [
    { w: 160, h: 52 },
    { w: 52, h: 160 },
    { w: 190, h: 58 },
    { w: 58, h: 190 },
  ],
  gorilla: [{ w: 220, h: 290 }],
  flower: [{ w: 170, h: 170 }],
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
