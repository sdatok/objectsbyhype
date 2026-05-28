/** Shared slime avatar presets for lobby + in-game rendering. */

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

export type SlimeColor = (typeof SLIME_COLORS)[number];

export const DEFAULT_SLIME_COLOR: SlimeColor = "#22d3ee";
export const SLIME_FACE_COUNT = 4;
export const SLIME_COLOR_KEY = "obh-survivor-slime-color";
export const SLIME_FACE_KEY = "obh-survivor-slime-face";

export function parseSlimeColor(raw: unknown): SlimeColor {
  const v = String(raw ?? "").trim().toLowerCase();
  return (SLIME_COLORS as readonly string[]).includes(v)
    ? (v as SlimeColor)
    : DEFAULT_SLIME_COLOR;
}

export function parseSlimeFace(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(SLIME_FACE_COUNT - 1, n));
}
