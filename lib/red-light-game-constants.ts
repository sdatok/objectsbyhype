/** Client-side mirror of game-server red-light-constants (display + timing only). */
export const RLGL_TRACK_WIDTH = 800;
export const RLGL_TRACK_LENGTH = 2600;
export const RLGL_START_Y = RLGL_TRACK_LENGTH / 2 - 120;
export const RLGL_FINISH_Y = -RLGL_TRACK_LENGTH / 2 + 100;

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
