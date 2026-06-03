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
export const SLIME_FACE_COUNT = 8;

export const SLIME_FACE_LABELS = [
  "Classic",
  "Shiny",
  "Tough",
  "Sleepy",
  "Angry",
  "Derp",
  "Wink",
  "Hearts",
] as const;

/** @deprecated Legacy bitmask — migrate via migrateLegacyAccessories(). */
export const SLIME_ACCESSORY_GUCCI_HAT = 1;
/** @deprecated Legacy bitmask */
export const SLIME_ACCESSORY_SUNGLASSES = 2;

export const SLIME_HEAD_NONE = 0;
export const SLIME_HEAD_GUCCI = 1;
export const SLIME_HEAD_SUNGLASSES = 2;
export const SLIME_HEAD_CROWN = 3;
export const SLIME_HEAD_BANDANA = 4;
export const SLIME_HEAD_HEADPHONES = 5;

export const SLIME_HEAD_ACCESSORIES = [
  { id: SLIME_HEAD_NONE, label: "None" },
  { id: SLIME_HEAD_GUCCI, label: "Gucci hat" },
  { id: SLIME_HEAD_SUNGLASSES, label: "Sunglasses" },
  { id: SLIME_HEAD_CROWN, label: "Crown" },
  { id: SLIME_HEAD_BANDANA, label: "Bandana" },
  { id: SLIME_HEAD_HEADPHONES, label: "Headphones" },
] as const;

export const SLIME_BODY_NONE = 0;
export const SLIME_BODY_CHAIN = 1;
export const SLIME_BODY_CAPE = 2;
export const SLIME_BODY_BACKPACK = 3;
export const SLIME_BODY_DRIP = 4;

export const SLIME_BODY_ACCESSORIES = [
  { id: SLIME_BODY_NONE, label: "None" },
  { id: SLIME_BODY_CHAIN, label: "Gold chain" },
  { id: SLIME_BODY_CAPE, label: "Cape" },
  { id: SLIME_BODY_BACKPACK, label: "Backpack" },
  { id: SLIME_BODY_DRIP, label: "Drip badge" },
] as const;

/** @deprecated Use SLIME_HEAD_ACCESSORIES / SLIME_BODY_ACCESSORIES */
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

export const NAME_OUTLINE_DEFAULT = 0;
export const NAME_OUTLINE_GLOW = 1;
export const NAME_OUTLINE_HEAVY = 2;

export const NAME_OUTLINES = [
  { id: NAME_OUTLINE_DEFAULT, label: "Default" },
  { id: NAME_OUTLINE_GLOW, label: "White glow" },
  { id: NAME_OUTLINE_HEAVY, label: "Black stroke" },
] as const;

export const NAME_BADGE_NONE = 0;
export const NAME_BADGE_STAR = 1;
export const NAME_BADGE_SKULL = 2;
export const NAME_BADGE_FLAME = 3;

export const NAME_BADGES = [
  { id: NAME_BADGE_NONE, label: "None", glyph: "" },
  { id: NAME_BADGE_STAR, label: "Star", glyph: "★" },
  { id: NAME_BADGE_SKULL, label: "Skull", glyph: "☠" },
  { id: NAME_BADGE_FLAME, label: "Flame", glyph: "🔥" },
] as const;

export const SLIME_COLOR_KEY = "obh-survivor-slime-color";
export const SLIME_FACE_KEY = "obh-survivor-slime-face";
/** @deprecated Migrated to head/body keys on load */
export const SLIME_ACCESSORIES_KEY = "obh-survivor-slime-accessories";
export const SLIME_HEAD_KEY = "obh-survivor-slime-head";
export const SLIME_BODY_KEY = "obh-survivor-slime-body";
export const NAME_COLOR_KEY = "obh-survivor-name-color";
export const NAME_OUTLINE_KEY = "obh-survivor-name-outline";
export const NAME_BADGE_KEY = "obh-survivor-name-badge";

const SLIME_HEAD_MAX = SLIME_HEAD_HEADPHONES;
const SLIME_BODY_MAX = SLIME_BODY_DRIP;

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

export function migrateLegacyAccessories(mask: number): {
  head: number;
  body: number;
} {
  let head = SLIME_HEAD_NONE;
  if (mask & SLIME_ACCESSORY_GUCCI_HAT) head = SLIME_HEAD_GUCCI;
  if (mask & SLIME_ACCESSORY_SUNGLASSES) head = SLIME_HEAD_SUNGLASSES;
  return { head, body: SLIME_BODY_NONE };
}

export function parseSlimeHeadAccessory(
  raw: unknown,
  legacyMask?: number
): number {
  const n = Math.floor(Number(raw));
  if (Number.isFinite(n) && n >= 0 && n <= SLIME_HEAD_MAX) return n;
  if (legacyMask !== undefined) return migrateLegacyAccessories(legacyMask).head;
  return SLIME_HEAD_NONE;
}

export function parseSlimeBodyAccessory(
  raw: unknown,
  legacyMask?: number
): number {
  const n = Math.floor(Number(raw));
  if (Number.isFinite(n) && n >= 0 && n <= SLIME_BODY_MAX) return n;
  if (legacyMask !== undefined) return migrateLegacyAccessories(legacyMask).body;
  return SLIME_BODY_NONE;
}

/** @deprecated Survivor uses head/body slots; Luna still reads legacy mask. */
export function parseSlimeAccessories(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return 0;
  return n & (SLIME_ACCESSORY_GUCCI_HAT | SLIME_ACCESSORY_SUNGLASSES);
}

/** @deprecated */
export function hasAccessory(mask: number, bit: number): boolean {
  return (mask & bit) !== 0;
}

/** @deprecated */
export function toggleAccessory(mask: number, bit: number): number {
  return hasAccessory(mask, bit) ? mask & ~bit : mask | bit;
}

export function parseNameColor(raw: unknown): NameColor {
  const v = String(raw ?? "").trim().toLowerCase();
  return (NAME_COLORS as readonly { id: string }[]).some((c) => c.id === v)
    ? (v as NameColor)
    : DEFAULT_NAME_COLOR;
}

export function parseNameOutline(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return NAME_OUTLINE_DEFAULT;
  return Math.max(NAME_OUTLINE_DEFAULT, Math.min(NAME_OUTLINE_HEAVY, n));
}

export function parseNameBadge(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return NAME_BADGE_NONE;
  return Math.max(NAME_BADGE_NONE, Math.min(NAME_BADGE_FLAME, n));
}

export function loadSlimeCustomizationFromStorage(): {
  slimeColor: SlimeColor;
  slimeFace: number;
  slimeHeadAccessory: number;
  slimeBodyAccessory: number;
  nameColor: NameColor;
  nameOutline: number;
  nameBadge: number;
} {
  try {
    const legacyMask = parseSlimeAccessories(
      localStorage.getItem(SLIME_ACCESSORIES_KEY)
    );
    return {
      slimeColor: parseSlimeColor(localStorage.getItem(SLIME_COLOR_KEY)),
      slimeFace: parseSlimeFace(localStorage.getItem(SLIME_FACE_KEY)),
      slimeHeadAccessory: parseSlimeHeadAccessory(
        localStorage.getItem(SLIME_HEAD_KEY),
        legacyMask
      ),
      slimeBodyAccessory: parseSlimeBodyAccessory(
        localStorage.getItem(SLIME_BODY_KEY),
        legacyMask
      ),
      nameColor: parseNameColor(localStorage.getItem(NAME_COLOR_KEY)),
      nameOutline: parseNameOutline(localStorage.getItem(NAME_OUTLINE_KEY)),
      nameBadge: parseNameBadge(localStorage.getItem(NAME_BADGE_KEY)),
    };
  } catch {
    return {
      slimeColor: DEFAULT_SLIME_COLOR,
      slimeFace: 0,
      slimeHeadAccessory: SLIME_HEAD_NONE,
      slimeBodyAccessory: SLIME_BODY_NONE,
      nameColor: DEFAULT_NAME_COLOR,
      nameOutline: NAME_OUTLINE_DEFAULT,
      nameBadge: NAME_BADGE_NONE,
    };
  }
}

export function saveSlimeCustomizationToStorage(opts: {
  slimeColor: SlimeColor;
  slimeFace: number;
  slimeHeadAccessory: number;
  slimeBodyAccessory: number;
  nameColor: NameColor;
  nameOutline: number;
  nameBadge: number;
}): void {
  localStorage.setItem(SLIME_COLOR_KEY, opts.slimeColor);
  localStorage.setItem(SLIME_FACE_KEY, String(opts.slimeFace));
  localStorage.setItem(SLIME_HEAD_KEY, String(opts.slimeHeadAccessory));
  localStorage.setItem(SLIME_BODY_KEY, String(opts.slimeBodyAccessory));
  localStorage.setItem(NAME_COLOR_KEY, opts.nameColor);
  localStorage.setItem(NAME_OUTLINE_KEY, String(opts.nameOutline));
  localStorage.setItem(NAME_BADGE_KEY, String(opts.nameBadge));
}
