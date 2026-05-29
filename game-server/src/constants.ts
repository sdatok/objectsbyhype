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
  | "pistol"
  | "shotgun"
  | "rapid"
  | "sniper"
  | "ice_bow"
  | "flamethrower"
  | "rocket";

/** Everyone spawns with a pistol; towers and pickups grant temporary upgrades. */
export const DEFAULT_WEAPON: WeaponKind = "pistol";

export const ALL_WEAPONS: WeaponKind[] = [
  "pistol",
  "shotgun",
  "rapid",
  "sniper",
  "ice_bow",
  "flamethrower",
  "rocket",
];

export interface WeaponSpec {
  cooldownMs: number;
  bulletSpeed: number;
  damage: number;
  pellets: number;
  /** Total cone width in radians; pellets distributed across it. */
  spreadRad: number;
  ttlSec: number;
  /** Rocket-only: splash radius on impact. */
  explodeRadius?: number;
  /** Rocket-only: splash damage at centre (falls off with distance). */
  splashDamage?: number;
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
  ice_bow: {
    cooldownMs: 520,
    bulletSpeed: 950,
    damage: 22,
    pellets: 1,
    spreadRad: (8 * Math.PI) / 180,
    ttlSec: 1.8,
  },
  flamethrower: {
    cooldownMs: 70,
    bulletSpeed: 420,
    damage: 5,
    pellets: 4,
    spreadRad: (24 * Math.PI) / 180,
    ttlSec: 0.32,
  },
  rocket: {
    cooldownMs: 950,
    bulletSpeed: 480,
    damage: 42,
    pellets: 1,
    spreadRad: 0,
    ttlSec: 2.4,
    explodeRadius: 130,
    splashDamage: 34,
  },
};

/** Temporary weapon from a tower lasts this long before reverting to pistol. */
export const WEAPON_BUFF_MS = 20_000;

/** Burn DoT from flamethrower hits. */
export const BURN_DURATION_MS = 3_200;
export const BURN_DPS = 10;

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
  { kind: "health", weight: 30 },
  { kind: "pistol", weight: 12 },
  { kind: "shotgun", weight: 12 },
  { kind: "rapid", weight: 10 },
  { kind: "sniper", weight: 8 },
  { kind: "ice_bow", weight: 8 },
  { kind: "flamethrower", weight: 10 },
  { kind: "rocket", weight: 8 },
];

// ---------- Slime avatars ----------
export const SLIME_COLORS = [
  "#22d3ee",
  "#a3e635",
  "#f472b6",
  "#fb923c",
  "#c084fc",
  "#facc15",
  "#38bdf8",
  "#4ade80",
  "#f87171",
  "#e879f9",
  "#2dd4bf",
  "#818cf8",
] as const;

export const DEFAULT_SLIME_COLOR = "#22d3ee";
export const SLIME_FACE_COUNT = 4;

export function parseSlimeColor(raw: unknown): string {
  const v = String(raw ?? "").trim().toLowerCase();
  return (SLIME_COLORS as readonly string[]).includes(v)
    ? v
    : DEFAULT_SLIME_COLOR;
}

export function parseSlimeFace(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(SLIME_FACE_COUNT - 1, n));
}

export const SLIME_ACCESSORY_GUCCI_HAT = 1;
export const SLIME_ACCESSORY_SUNGLASSES = 2;

export const NAME_COLORS = [
  "#ffffff",
  "#22d3ee",
  "#facc15",
  "#f472b6",
  "#a3e635",
  "#fb923c",
  "#e879f9",
] as const;

export const DEFAULT_NAME_COLOR = "#ffffff";

export function parseSlimeAccessories(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return 0;
  return n & (SLIME_ACCESSORY_GUCCI_HAT | SLIME_ACCESSORY_SUNGLASSES);
}

export function parseNameColor(raw: unknown): string {
  const v = String(raw ?? "").trim().toLowerCase();
  return (NAME_COLORS as readonly string[]).includes(v)
    ? v
    : DEFAULT_NAME_COLOR;
}

// ---------- Vendor towers ----------
/** Weapon granted when standing in the active tower glow ring during a cycle. */
export type TowerBonusKind = WeaponKind;

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

export const TOWER_CYCLE_MS = 60_000;
export const TOWER_BUFF_RADIUS = 250;

/** Rotates in lockstep with vendor towers — one featured weapon per cycle. */
export const TOWER_WEAPON_CYCLE: WeaponKind[] = [
  "pistol",
  "shotgun",
  "rapid",
  "sniper",
  "ice_bow",
  "flamethrower",
  "rocket",
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
export const MIN_LOBBY_SECONDS = 1;
export const MAX_LOBBY_SECONDS = 600;
export const MIN_MATCH_SECONDS = 10;
export const MAX_MATCH_SECONDS = 3600;
export const MAX_PLAYERS = 25;

// ---------- Anti-cheat ----------
/** Max input messages per second; anything above is dropped silently. */
export const MAX_INPUTS_PER_SEC = 60;
