export {
  TICK_MS,
  PLAYER_RADIUS,
  MAX_INPUTS_PER_SEC,
  DEFAULT_SLIME_COLOR,
  DEFAULT_NAME_COLOR,
  DEFAULT_WEAPON,
  parseSlimeColor,
  parseSlimeFace,
  parseSlimeAccessories,
  parseNameColor,
} from "./constants";

function parseRedLightMaxPlayers(raw: string | undefined): number {
  const n = parseInt(raw ?? "50", 10);
  if (!Number.isFinite(n)) return 50;
  return Math.max(2, Math.min(100, n));
}

export const RED_LIGHT_MAX_PLAYERS = parseRedLightMaxPlayers(
  process.env.RED_LIGHT_MAX_PLAYERS
);

export { RED_LIGHT_MAX_PLAYERS as MAX_PLAYERS };

/** Default ~2 min to cross the field. */
export const RLGL_DEFAULT_MATCH_SECONDS = 120;

export const RLGL_TRACK_WIDTH = 800;
/** Longer field — ~2 min with red-light stops at default speed. */
export const RLGL_TRACK_LENGTH = 2600;
export const RLGL_START_Y = RLGL_TRACK_LENGTH / 2 - 120;
export const RLGL_FINISH_Y = -RLGL_TRACK_LENGTH / 2 + 100;

export const RLGL_PLAYER_SPEED = 268;
export const RLGL_MAX_SPEED = 318;
export const RLGL_ACCEL = 520;
export const RLGL_DECEL = 680;
/** Movement during red light above this → eliminated. */
export const RLGL_MOVE_TOLERANCE = 11;
export const RLGL_FORWARD_THRESHOLD = 0.28;

export type LightPhase = "GREEN" | "TURNING" | "RED";

export function rlglRoundTiming(round: number): {
  greenMs: number;
  turningMs: number;
  redMs: number;
} {
  const r = Math.max(1, round);
  return {
    greenMs: Math.max(1600, 4800 - r * 540),
    turningMs: Math.max(380, 1100 - r * 90),
    redMs: Math.max(2000, 3600 - r * 240),
  };
}
