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

export const SLIME_ACCESSORY_GUCCI_HAT = 1;
export const SLIME_ACCESSORY_SUNGLASSES = 2;

export const SLIME_ACCESSORIES = [
  { bit: SLIME_ACCESSORY_GUCCI_HAT, label: "Gucci hat", short: "Hat" },
  { bit: SLIME_ACCESSORY_SUNGLASSES, label: "Sunglasses", short: "Shades" },
] as const;

export const NAME_COLORS = [
  { id: "#ffffff", label: "White" },
  { id: "#22d3ee", label: "Cyan" },
  { id: "#facc15", label: "Gold" },
  { id: "#f472b6", label: "Pink" },
  { id: "#a3e635", label: "Lime" },
  { id: "#fb923c", label: "Orange" },
  { id: "#e879f9", label: "Purple" },
] as const;

export type NameColor = (typeof NAME_COLORS)[number]["id"];

export const DEFAULT_NAME_COLOR: NameColor = "#ffffff";

export const SLIME_COLOR_KEY = "obh-survivor-slime-color";
export const SLIME_FACE_KEY = "obh-survivor-slime-face";
export const SLIME_ACCESSORIES_KEY = "obh-survivor-slime-accessories";
export const NAME_COLOR_KEY = "obh-survivor-name-color";

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

export function parseSlimeAccessories(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return 0;
  return (
    n &
    (SLIME_ACCESSORY_GUCCI_HAT | SLIME_ACCESSORY_SUNGLASSES)
  );
}

export function hasAccessory(mask: number, bit: number): boolean {
  return (mask & bit) !== 0;
}

export function toggleAccessory(mask: number, bit: number): number {
  return hasAccessory(mask, bit) ? mask & ~bit : mask | bit;
}

export function parseNameColor(raw: unknown): NameColor {
  const v = String(raw ?? "").trim().toLowerCase();
  return (NAME_COLORS as readonly { id: string }[]).some((c) => c.id === v)
    ? (v as NameColor)
    : DEFAULT_NAME_COLOR;
}
