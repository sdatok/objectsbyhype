import type {
  GiveawayWheelConfig,
  GiveawayWheelPrize,
  WheelPrizeTier,
} from "@prisma/client";
import { GIVEAWAY_WHEEL_TIERS } from "@/lib/giveaway-wheel-config";

export interface GiveawayWheelTierOdds {
  tier: WheelPrizeTier;
  weight: number;
  tierPercent: number;
  prizeCount: number;
  perPrizePercent: number;
}

export interface GiveawayWheelPrizeOdds {
  id: string;
  label: string;
  tier: WheelPrizeTier;
  quantityRemaining: number;
  overallPercent: number;
}

export interface GiveawayWheelOddsBreakdown {
  weights: { common: number; rare: number; jackpot: number };
  tiers: GiveawayWheelTierOdds[];
  prizes: GiveawayWheelPrizeOdds[];
}

function tierWeight(config: GiveawayWheelConfig, tier: WheelPrizeTier): number {
  if (tier === "COMMON") return config.commonWeight;
  if (tier === "RARE") return config.rareWeight;
  return config.jackpotWeight;
}

export function computeGiveawayWheelOdds(
  config: GiveawayWheelConfig,
  prizes: GiveawayWheelPrize[]
): GiveawayWheelOddsBreakdown {
  const available = prizes.filter(
    (p) =>
      p.active &&
      p.quantityRemaining > 0 &&
      p.label !== "__giveaway_catalog_version__"
  );

  const tierEntries: Array<{ tier: WheelPrizeTier; weight: number; count: number }> =
    [];
  for (const tier of GIVEAWAY_WHEEL_TIERS) {
    const count = available.filter((p) => p.tier === tier).length;
    if (count === 0) continue;
    const weight = tierWeight(config, tier);
    if (weight <= 0) continue;
    tierEntries.push({ tier, weight, count });
  }

  const totalWeight = tierEntries.reduce((s, t) => s + t.weight, 0);

  const tiers: GiveawayWheelTierOdds[] = tierEntries.map(
    ({ tier, weight, count }) => {
      const tierPercent = totalWeight > 0 ? (weight / totalWeight) * 100 : 0;
      const perPrizePercent = count > 0 ? tierPercent / count : 0;
      return { tier, weight, tierPercent, prizeCount: count, perPrizePercent };
    }
  );

  const tierPercentByTier = new Map(
    tiers.map((t) => [t.tier, t.perPrizePercent] as const)
  );

  const prizeOdds: GiveawayWheelPrizeOdds[] = available
    .map((p) => ({
      id: p.id,
      label: p.label,
      tier: p.tier,
      quantityRemaining: p.quantityRemaining,
      overallPercent: tierPercentByTier.get(p.tier) ?? 0,
    }))
    .sort((a, b) => b.overallPercent - a.overallPercent);

  return {
    weights: {
      common: config.commonWeight,
      rare: config.rareWeight,
      jackpot: config.jackpotWeight,
    },
    tiers,
    prizes: prizeOdds,
  };
}
