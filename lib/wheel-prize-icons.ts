export type PrizeIconType =
  | "hat"
  | "cash"
  | "hoodie"
  | "pants"
  | "glasses"
  | "wallet"
  | "shorts"
  | "shirt"
  | "jewelry"
  | "gift";

/** Map prize label text to a small 8-bit icon category. */
export function prizeIconType(label: string): PrizeIconType {
  const l = label.toLowerCase();
  if (/\$|cash|credit/.test(l)) return "cash";
  if (/beanie|hat|ski mask|cap/.test(l)) return "hat";
  if (/hoodie/.test(l)) return "hoodie";
  if (/jeans|sweats/.test(l)) return "pants";
  if (/shorts/.test(l)) return "shorts";
  if (/glasses/.test(l)) return "glasses";
  if (/wallet|card holder|passport/.test(l)) return "wallet";
  if (/shirt|jersey/.test(l)) return "shirt";
  if (/jewelry|keychain/.test(l)) return "jewelry";
  return "gift";
}

/** Tier accent colors for prize cards. */
export const TIER_STYLES = {
  COMMON: { color: "#22d3ee", headline: "NICE PULL" },
  RARE: { color: "#a855f7", headline: "RARE HIT" },
  JACKPOT: { color: "#fbbf24", headline: "JACKPOT" },
} as const;

export type WheelTier = keyof typeof TIER_STYLES;
