import type { WheelPrizeTier } from "@prisma/client";
import { prizeIconType, type PrizeIconType } from "@/lib/wheel-prize-icons";

export type GiveawayWheelTier = WheelPrizeTier;

export const GIVEAWAY_TIER_STYLES: Record<
  GiveawayWheelTier,
  { color: string; headline: string }
> = {
  COMMON: { color: "#34d399", headline: "COMMON" },
  RARE: { color: "#38bdf8", headline: "RARE" },
  JACKPOT: { color: "#fbbf24", headline: "JACKPOT" },
};

export function giveawayPrizeIconType(label: string): PrizeIconType {
  if (label.includes("Spin Again")) return "gift";
  if (label.includes("Store Credit")) return "dollar";
  if (label.includes("PRO")) return "gift";
  if (label.includes("Jewelry")) return "jewelry";
  if (label.includes("Beanie")) return "hat";
  if (label.includes("Keychain")) return "jewelry";
  if (label.includes("Accessories")) return "shirt";
  return prizeIconType(label);
}
