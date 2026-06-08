import type { WheelPrizeTier } from "@prisma/client";

export const GIVEAWAY_WHEEL_CONFIG_ID = "default";

export const GIVEAWAY_WHEEL_DEFAULT_QUANTITY = 10;

export const GIVEAWAY_WHEEL_CATALOG_VERSION = 2;

export const GIVEAWAY_WHEEL_SPIN_AGAIN_LABEL = "Spin Again 🔄";

export const DEFAULT_GIVEAWAY_TIER_WEIGHTS = {
  commonWeight: 60,
  rareWeight: 30,
  jackpotWeight: 10,
} as const;

export type GiveawayWheelTier = WheelPrizeTier;

export const GIVEAWAY_WHEEL_TIERS: GiveawayWheelTier[] = [
  "COMMON",
  "RARE",
  "JACKPOT",
];

export const GIVEAWAY_WHEEL_TIER_LABELS: Record<GiveawayWheelTier, string> = {
  COMMON: "Common",
  RARE: "Rare",
  JACKPOT: "Jackpot",
};

export const GIVEAWAY_WHEEL_SEED_PRIZES: Array<{
  label: string;
  tier: GiveawayWheelTier;
  sortOrder: number;
}> = [
  { label: "Free ObjectsByHype Item", tier: "RARE", sortOrder: 1 },
  { label: "Random Beanie", tier: "RARE", sortOrder: 2 },
  { label: "Random Keychain", tier: "RARE", sortOrder: 3 },
  { label: "Random Accessories", tier: "RARE", sortOrder: 4 },
  { label: "Random ObjectsByHype Item", tier: "RARE", sortOrder: 5 },
  { label: "Random Beanie", tier: "RARE", sortOrder: 6 },
  { label: "Random Keychain", tier: "RARE", sortOrder: 7 },
  { label: "Random Accessories Bundle", tier: "RARE", sortOrder: 8 },
  { label: "Random Jewelry Piece", tier: "RARE", sortOrder: 9 },
  { label: GIVEAWAY_WHEEL_SPIN_AGAIN_LABEL, tier: "RARE", sortOrder: 10 },
  { label: "Free ObjectsByHype Item", tier: "RARE", sortOrder: 11 },
  { label: "Random Accessories", tier: "RARE", sortOrder: 12 },
  { label: "$20 Store Credit", tier: "RARE", sortOrder: 13 },
];
