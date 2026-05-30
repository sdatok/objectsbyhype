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
export const LUNA_RADIUS = 26;
/** Obstacle sliding uses a slightly smaller radius so Luna navigates maze corners. */
export const LUNA_NAV_RADIUS = 20;
/** Starting chase speed (units/sec). */
export const LUNA_SPEED_START = 200;
/** Max chase speed — can exceed PLAYER_SPEED (280) late match. */
export const LUNA_SPEED_MAX = 340;
/** How quickly Luna steers toward her target (higher = snappier tracking). */
export const LUNA_STEER_RATE = 13;
/** Lead prediction on moving targets (seconds). */
export const LUNA_PREDICT_SEC = 0.55;
/** Extra speed boost when closing within this range. */
export const LUNA_CLOSE_RANGE = 420;

/** Maze density — more walls than Survivor island. */
export const LUNA_CLIFF_CLUSTER_COUNT = 14;
export const LUNA_MAZE_SPOKE_COUNT = 12;
export const LUNA_RING_WALL_COUNT = 5;
export const LUNA_EXTRA_WALL_SEGMENTS = 24;
