/**
 * Escape Luna — run from Luna the dog. No guns, slimes, or volcano.
 */

export {
  WORLD_SIZE,
  WORLD_HALF,
  TICK_MS,
  PLAYER_RADIUS,
  PLAYER_MAX_HP,
  PLAYER_SPEED,
  MAX_PLAYERS,
  DEFAULT_LOBBY_SECONDS,
  MIN_LOBBY_SECONDS,
  MAX_LOBBY_SECONDS,
  MIN_MATCH_SECONDS,
  MAX_MATCH_SECONDS,
  DEFAULT_MATCH_SECONDS,
  MAX_INPUTS_PER_SEC,
  DEFAULT_WEAPON,
  DEFAULT_SLIME_COLOR,
  DEFAULT_NAME_COLOR,
  parseSlimeColor,
  parseSlimeFace,
  parseSlimeAccessories,
  parseNameColor,
} from "./constants";

/** Safe zone — same scale as Survivor island. */
export const LUNA_ZONE_START_RADIUS = 1900;
export const LUNA_ZONE_END_RADIUS = 320;
export const LUNA_ZONE_DPS_START = 4;
export const LUNA_ZONE_DPS_END = 28;

/** Luna the dog. */
export const LUNA_RADIUS = 18;
/** Obstacle sliding uses a slightly smaller radius so Luna navigates maze corners. */
export const LUNA_NAV_RADIUS = 14;
/** Starting chase speed (units/sec). */
export const LUNA_SPEED_START = 170;
/** Max chase speed late match (slightly below player sprint). */
export const LUNA_SPEED_MAX = 290;
/** How quickly Luna steers toward her target (higher = snappier tracking). */
export const LUNA_STEER_RATE = 13;
/** Lead prediction on moving targets (seconds). */
export const LUNA_PREDICT_SEC = 0.55;
/** Extra speed boost when closing within this range. */
export const LUNA_CLOSE_RANGE = 420;
/** If Luna barely moves while chasing for this long, she leaps over the blocker. */
export const LUNA_STUCK_JUMP_MS = 3000;
/** Per-tick movement below this while chasing counts as stuck. */
export const LUNA_STUCK_MOVE_EPS = 6;

/** Player bump — overlap separation + shove from mover input. */
export const LUNA_PLAYER_PUSH_ITERATIONS = 4;
export const LUNA_PLAYER_PUSH_TRANSFER = 0.92;

/** Fall-through pits scattered on the arena floor. */
export const LUNA_PIT_COUNT = 5;
export const LUNA_PIT_RADIUS_MIN = 88;
export const LUNA_PIT_RADIUS_MAX = 128;
export const LUNA_PIT_MIN_SPACING = 200;

/** Keep runner spawns away from Luna at match start. */
export const LUNA_SPAWN_CLEAR_RADIUS = 340;

/** Eliminated runners become puppies that can tag survivors. */
export const LUNA_PUPPY_RADIUS = 11;
export const LUNA_PUPPY_SPEED = 248;
export const LUNA_PUPPY_CATCH_PAD = 0.88;

/** Survivors speed up as the puppy swarm grows; last runner gets a big boost. */
export const LUNA_INFECTED_SPEED_BONUS = 0.72;
export const LUNA_LAST_SURVIVOR_SPEED_BONUS = 0.48;
export const LUNA_SURVIVOR_SPEED_CAP = 2.08;

/** Every 30s Luna stops to fire piercing shots (dodgeable). */
export const LUNA_SHOOT_INTERVAL_MS = 30000;
export const LUNA_SHOOT_DURATION_MS = 2800;
export const LUNA_SHOOT_BULLET_INTERVAL_MS = 480;
export const LUNA_BULLET_SPEED = 460;
export const LUNA_BULLET_RADIUS = 5;
export const LUNA_BULLET_TTL_MS = 4500;
export const LUNA_BULLET_SPREAD_RAD = 0.11;
export const LUNA_BULLET_MAX = 28;

/** Maze density — more walls than Survivor island. */
export const LUNA_CLIFF_CLUSTER_COUNT = 14;
export const LUNA_MAZE_SPOKE_COUNT = 12;
export const LUNA_RING_WALL_COUNT = 5;
export const LUNA_EXTRA_WALL_SEGMENTS = 24;
