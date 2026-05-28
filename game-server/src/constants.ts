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
export type WeaponKind =
  | "sword"
  | "fire_sword"
  | "pistol"
  | "shotgun"
  | "rapid"
  | "sniper"
  | "ice_bow";

/** Everyone spawns with melee; guns come from towers / pickups. */
export const DEFAULT_WEAPON: WeaponKind = "sword";

export const MELEE_WEAPONS: WeaponKind[] = ["sword", "fire_sword"];

/** Random gun rolled when visiting the active vendor tower during a cycle. */
export const GUN_WEAPONS: WeaponKind[] = [
  "pistol",
  "shotgun",
  "rapid",
  "sniper",
  "ice_bow",
];

export interface WeaponSpec {
  cooldownMs: number;
  bulletSpeed: number;
  damage: number;
  pellets: number;
  /** Total cone width in radians; pellets distributed across it. */
  spreadRad: number;
  ttlSec: number;
  /** Melee-only: reach from player centre. */
  meleeRange?: number;
  /** Melee-only: half-angle of forward arc (radians). */
  meleeArcRad?: number;
}

export const WEAPONS: Record<WeaponKind, WeaponSpec> = {
  sword: {
    cooldownMs: 550,
    bulletSpeed: 0,
    damage: 45,
    pellets: 0,
    spreadRad: 0,
    ttlSec: 0,
    meleeRange: 70,
    meleeArcRad: (75 * Math.PI) / 180,
  },
  fire_sword: {
    cooldownMs: 620,
    bulletSpeed: 0,
    damage: 38,
    pellets: 0,
    spreadRad: 0,
    ttlSec: 0,
    meleeRange: 72,
    meleeArcRad: (80 * Math.PI) / 180,
  },
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
  ice_bow: {
    cooldownMs: 520,
    bulletSpeed: 950,
    damage: 22,
    pellets: 1,
    spreadRad: (8 * Math.PI) / 180,
    ttlSec: 1.8,
  },
};

/** Temporary gun from a tower lasts this long before reverting to melee. */
export const WEAPON_BUFF_MS = 20_000;

/** Burn DoT from fire sword hits. */
export const BURN_DURATION_MS = 3_500;
export const BURN_DPS = 9;

/** Freeze slow from ice bow hits. */
export const FREEZE_DURATION_MS = 2_800;
export const FREEZE_SLOW_SCALE = 0.48;

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
  { kind: "health", weight: 32 },
  { kind: "fire_sword", weight: 18 },
  { kind: "pistol", weight: 12 },
  { kind: "shotgun", weight: 12 },
  { kind: "rapid", weight: 10 },
  { kind: "sniper", weight: 8 },
  { kind: "ice_bow", weight: 8 },
];

// ---------- Vendor towers ----------
/** Active tower cycles grant a random gun to players who enter the glow ring. */
export type TowerBonusKind = "guns";

export type TowerKind =
  | "tower_kt_corp"
  | "tower_dan_sporting"
  | "tower_horizon"
  | "tower_goat"
  | "tower_src"
  | "tower_pax"
  | "tower_internet_money"
  | "tower_tomy"
  | "tower_ror_sply"
  | "tower_gus_supply";

export const TOWER_KINDS: TowerKind[] = [
  "tower_kt_corp",
  "tower_dan_sporting",
  "tower_horizon",
  "tower_goat",
  "tower_src",
  "tower_pax",
  "tower_internet_money",
  "tower_tomy",
  "tower_ror_sply",
  "tower_gus_supply",
];

export const TOWER_DISPLAY_NAMES: Record<TowerKind, string> = {
  tower_kt_corp: "K-T CORP",
  tower_dan_sporting: "DAN SPORTING",
  tower_horizon: "6HORIZONLLC",
  tower_goat: "GOAT",
  tower_src: "SRC",
  tower_pax: "PAX ECOMMERCE",
  tower_internet_money: "INTERNET MONEY",
  tower_tomy: "TOMY",
  tower_ror_sply: "ROR SPLY",
  tower_gus_supply: "GUS SUPPLY",
};

/** Fixed scattered positions (x, y) for each vendor tower. */
export const TOWER_PLACEMENTS: Array<{ kind: TowerKind; x: number; y: number }> = [
  { kind: "tower_ror_sply", x: -820, y: -640 },
  { kind: "tower_internet_money", x: 0, y: -980 },
  { kind: "tower_src", x: 780, y: -520 },
  { kind: "tower_pax", x: -1050, y: 120 },
  { kind: "tower_goat", x: 920, y: 680 },
  { kind: "tower_horizon", x: -480, y: 860 },
  { kind: "tower_kt_corp", x: 1050, y: -80 },
  { kind: "tower_dan_sporting", x: -680, y: -180 },
  { kind: "tower_tomy", x: 420, y: 920 },
  { kind: "tower_gus_supply", x: -200, y: -420 },
];

export const TOWER_CYCLE_MS = 75_000;
export const TOWER_BUFF_RADIUS = 140;

export const TOWER_BONUS_KINDS: TowerBonusKind[] = ["guns"];

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
export const STANDALONE_OBSTACLE_COUNT = 18;
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

export type ObstacleKind =
  | "cliff"
  | "rock"
  | "palm"
  | "wreck"
  | "gorilla"
  | "flower"
  | TowerKind;

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
  tower_kt_corp: [{ w: 160, h: 280 }],
  tower_dan_sporting: [{ w: 160, h: 280 }],
  tower_horizon: [{ w: 170, h: 290 }],
  tower_goat: [{ w: 165, h: 285 }],
  tower_src: [{ w: 165, h: 285 }],
  tower_pax: [{ w: 170, h: 295 }],
  tower_internet_money: [{ w: 175, h: 300 }],
  tower_tomy: [{ w: 160, h: 280 }],
  tower_ror_sply: [{ w: 165, h: 285 }],
  tower_gus_supply: [{ w: 165, h: 285 }],
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
