import type { WheelPrizeTier } from "@prisma/client";

export const WHEEL_CONFIG_ID = "default";

export const WHEEL_DEFAULT_QUANTITY = 5;

export const DEFAULT_TIER_WEIGHTS = {
  commonWeight: 60,
  rareWeight: 30,
  jackpotWeight: 10,
} as const;

export type WheelTier = WheelPrizeTier;

export const WHEEL_TIERS: WheelTier[] = ["COMMON", "RARE", "JACKPOT"];

export const WHEEL_TIER_LABELS: Record<WheelTier, string> = {
  COMMON: "Common",
  RARE: "Rare",
  JACKPOT: "Jackpot",
};

/** Current calendar month key in UTC (YYYY-MM). */
export function currentMonthKey(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function formatMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  if (!y || !m) return monthKey;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
  return date.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export const WHEEL_SEED_PRIZES: Array<{
  label: string;
  tier: WheelTier;
  sortOrder: number;
}> = [
  { label: "AMIRI Jeans", tier: "JACKPOT", sortOrder: 1 },
  { label: "Louis Vuitton Wallet", tier: "JACKPOT", sortOrder: 2 },
  { label: "Goyard Wallet", tier: "JACKPOT", sortOrder: 3 },
  { label: "$100 Cash", tier: "JACKPOT", sortOrder: 4 },
  { label: "$75 Cash", tier: "JACKPOT", sortOrder: 5 },
  { label: "$100 Store Credit", tier: "JACKPOT", sortOrder: 6 },
  { label: "Chrome Hearts Glasses", tier: "RARE", sortOrder: 7 },
  { label: "Nike Tech Fleece Hoodie", tier: "RARE", sortOrder: 8 },
  { label: "Nike Tech Fleece Sweats", tier: "RARE", sortOrder: 9 },
  { label: "Eric Emanuel Shorts", tier: "RARE", sortOrder: 10 },
  { label: "Designer Superclone Hoodie", tier: "RARE", sortOrder: 11 },
  { label: "Designer Superclone Shirt", tier: "RARE", sortOrder: 12 },
  { label: "Streetwear Superclone Item", tier: "RARE", sortOrder: 13 },
  { label: "Goyard Passport Holder", tier: "RARE", sortOrder: 14 },
  { label: "Goyard Card Holder", tier: "RARE", sortOrder: 15 },
  { label: "Gucci x Palace Skateboards Hat", tier: "RARE", sortOrder: 16 },
  { label: "Hellstar Ski Mask", tier: "RARE", sortOrder: 17 },
  { label: "Random SC Jewelry Piece", tier: "RARE", sortOrder: 18 },
  { label: "Sports Jersey", tier: "RARE", sortOrder: 19 },
  { label: "$100 Store Credit", tier: "RARE", sortOrder: 20 },
  { label: "$75 Store Credit", tier: "RARE", sortOrder: 21 },
  { label: "$50 Store Credit", tier: "RARE", sortOrder: 22 },
  { label: "$25 Store Credit", tier: "RARE", sortOrder: 23 },
  { label: "$100 OBH Bundle", tier: "RARE", sortOrder: 24 },
  { label: "$150 OBH Bundle", tier: "RARE", sortOrder: 25 },
  { label: "$200 OBH Bundle", tier: "RARE", sortOrder: 26 },
  { label: "Supreme Keychain", tier: "COMMON", sortOrder: 27 },
  { label: "Arc'teryx Beanie", tier: "COMMON", sortOrder: 28 },
  { label: "Stüssy Beanie", tier: "COMMON", sortOrder: 29 },
  { label: "$50 Cash", tier: "COMMON", sortOrder: 30 },
  { label: "$40 Cash", tier: "COMMON", sortOrder: 31 },
  { label: "$35 Cash", tier: "COMMON", sortOrder: 32 },
  { label: "$25 Cash", tier: "COMMON", sortOrder: 33 },
  { label: "$20 Cash", tier: "COMMON", sortOrder: 34 },
];
