import type { WheelConfig, WheelPrize, WheelPrizeTier } from "@prisma/client";
import { WHEEL_TIERS } from "@/lib/wheel-config";

export interface WheelTierOdds {
  tier: WheelPrizeTier;
  weight: number;
  /** Share of spins landing in this tier (0–100). */
  tierPercent: number;
  prizeCount: number;
  /** Per-prize chance within the tier (0–100). */
  perPrizePercent: number;
}

export interface WheelPrizeOdds {
  id: string;
  label: string;
  tier: WheelPrizeTier;
  quantityRemaining: number;
  /** Overall chance to win this prize on a single spin (0–100). */
  overallPercent: number;
}

export interface WheelOddsBreakdown {
  weights: { common: number; rare: number; jackpot: number };
  tiers: WheelTierOdds[];
  prizes: WheelPrizeOdds[];
}

function tierWeight(config: WheelConfig, tier: WheelPrizeTier): number {
  if (tier === "COMMON") return config.commonWeight;
  if (tier === "RARE") return config.rareWeight;
  return config.jackpotWeight;
}

/** Mirrors server pick logic: weighted tier, then uniform prize within tier. */
export function computeWheelOdds(
  config: WheelConfig,
  prizes: WheelPrize[]
): WheelOddsBreakdown {
  const available = prizes.filter((p) => p.active && p.quantityRemaining > 0);

  const tierEntries: Array<{ tier: WheelPrizeTier; weight: number; count: number }> =
    [];
  for (const tier of WHEEL_TIERS) {
    const count = available.filter((p) => p.tier === tier).length;
    if (count === 0) continue;
    const weight = tierWeight(config, tier);
    if (weight <= 0) continue;
    tierEntries.push({ tier, weight, count });
  }

  const totalWeight = tierEntries.reduce((s, t) => s + t.weight, 0);

  const tiers: WheelTierOdds[] = tierEntries.map(({ tier, weight, count }) => {
    const tierPercent = totalWeight > 0 ? (weight / totalWeight) * 100 : 0;
    const perPrizePercent = count > 0 ? tierPercent / count : 0;
    return { tier, weight, tierPercent, prizeCount: count, perPrizePercent };
  });

  const tierPercentByTier = new Map(
    tiers.map((t) => [t.tier, t.perPrizePercent] as const)
  );

  const prizeOdds: WheelPrizeOdds[] = available
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
