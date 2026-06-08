import type { WheelPrizeTier } from "@prisma/client";

export const GIVEAWAY_WHEEL_CONFIG_ID = "default";

export const GIVEAWAY_WHEEL_DEFAULT_QUANTITY = 10;

export const GIVEAWAY_WHEEL_CATALOG_VERSION = 1;

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
  { label: "Free ObjectsByHype Item", tier: "COMMON", sortOrder: 1 },
  { label: "Random Beanie", tier: "COMMON", sortOrder: 2 },
  { label: "Random Keychain", tier: "COMMON", sortOrder: 3 },
  { label: "Random Accessories", tier: "COMMON", sortOrder: 4 },
  { label: "Random ObjectsByHype Item", tier: "COMMON", sortOrder: 5 },
  { label: "Random Beanie", tier: "COMMON", sortOrder: 6 },
  { label: "Random Keychain", tier: "COMMON", sortOrder: 7 },
  { label: "Random Accessories Bundle", tier: "RARE", sortOrder: 8 },
  { label: "Slime PRO (1 Week)", tier: "JACKPOT", sortOrder: 9 },
  { label: "Random Jewelry Piece", tier: "RARE", sortOrder: 10 },
  { label: GIVEAWAY_WHEEL_SPIN_AGAIN_LABEL, tier: "RARE", sortOrder: 11 },
  { label: "Free ObjectsByHype Item", tier: "COMMON", sortOrder: 12 },
  { label: "Random Accessories", tier: "COMMON", sortOrder: 13 },
  { label: "$20 Store Credit", tier: "JACKPOT", sortOrder: 14 },
];
