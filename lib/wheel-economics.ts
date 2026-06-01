import type { WheelConfig, WheelPrize } from "@prisma/client";
import { computeWheelOdds } from "@/lib/wheel-odds";

/** Estimated cost to OBH per prize (USD). Cash = face value. */
export const WHEEL_PRIZE_COST_ESTIMATE: Record<string, number> = {
  "Supreme Keychain": 10,
  "Arc'teryx Beanie": 10,
  "Stüssy Beanie": 10,
  "$50 Cash": 50,
  "$40 Cash": 40,
  "$35 Cash": 35,
  "$25 Cash": 25,
  "$20 Cash": 20,
  "Chrome Hearts Glasses": 30,
  "Nike Tech Fleece Hoodie": 25,
  "Nike Tech Fleece Sweats": 25,
  "Eric Emanuel Shorts": 25,
  "Designer Superclone Hoodie": 25,
  "Designer Superclone Shirt": 25,
  "Streetwear Superclone Item": 25,
  "Goyard Passport Holder": 25,
  "Goyard Card Holder": 10,
  "Takashi Murakami Pin Plushie": 12,
  "Gucci x Palace Skateboards Hat": 25,
  "Hellstar Ski Mask": 25,
  "Random SC Jewelry Piece": 25,
  "Sports Jersey": 25,
  "$100 Store Credit": 100,
  "$75 Store Credit": 75,
  "$50 Store Credit": 50,
  "$25 Store Credit": 25,
  "$100 OBH Bundle": 100,
  "$150 OBH Bundle": 150,
  "$200 OBH Bundle": 200,
  "AMIRI Jeans": 37.5,
  "Louis Vuitton Wallet": 37.5,
};

const DEFAULT_COMMON_COST = 10;
const DEFAULT_RARE_COST = 25;
const DEFAULT_JACKPOT_COST = 37.5;

export function estimatePrizeCost(prize: Pick<WheelPrize, "label" | "tier">): number {
  if (prize.label === "$100 Store Credit" && prize.tier === "RARE") {
    return 100;
  }
  if (prize.label === "$100 Store Credit" && prize.tier === "JACKPOT") {
    return DEFAULT_JACKPOT_COST;
  }

  const mapped = WHEEL_PRIZE_COST_ESTIMATE[prize.label];
  if (mapped != null) return mapped;
  if (prize.tier === "COMMON") return DEFAULT_COMMON_COST;
  if (prize.tier === "RARE") return DEFAULT_RARE_COST;
  return DEFAULT_JACKPOT_COST;
}

export interface WheelEconomicsBreakdown {
  spinPrice: number;
  expectedPayout: number;
  expectedProfit: number;
  marginPercent: number;
  tierEv: Array<{
    tier: string;
    tierPercent: number;
    prizeCount: number;
    tierEv: number;
  }>;
  prizes: Array<{
    label: string;
    tier: string;
    winPercent: number;
    costLow: number;
    costHigh: number;
    costMid: number;
    evContribution: number;
  }>;
}

function costRange(prize: Pick<WheelPrize, "label" | "tier">): {
  low: number;
  high: number;
  mid: number;
} {
  const mid = estimatePrizeCost(prize);
  if (prize.label.includes("Cash")) {
    return { low: mid, high: mid, mid };
  }
  if (
    prize.label.includes("Store Credit") ||
    prize.label.includes("Bundle")
  ) {
    if (prize.label === "$100 Store Credit" && prize.tier === "JACKPOT") {
      return { low: 25, high: 50, mid: 37.5 };
    }
    return { low: mid, high: mid, mid };
  }
  if (prize.tier === "COMMON") return { low: 5, high: 15, mid: 10 };
  if (prize.tier === "RARE") return { low: 15, high: 35, mid: 25 };
  return { low: 25, high: 50, mid: 37.5 };
}

export function computeWheelEconomics(
  config: WheelConfig,
  prizes: WheelPrize[],
  spinPrice = 50
): WheelEconomicsBreakdown {
  const odds = computeWheelOdds(config, prizes);
  const active = prizes.filter((p) => p.active && p.quantityRemaining > 0);

  const prizeRows = odds.prizes.map((o) => {
    const prize = active.find((p) => p.id === o.id)!;
    const range = costRange(prize);
    const evContribution = (o.overallPercent / 100) * range.mid;
    return {
      label: o.label,
      tier: o.tier,
      winPercent: o.overallPercent,
      costLow: range.low,
      costHigh: range.high,
      costMid: range.mid,
      evContribution,
    };
  });

  const tierEv = odds.tiers.map((t) => {
    const tierPrizes = prizeRows.filter((p) => p.tier === t.tier);
    return {
      tier: t.tier,
      tierPercent: t.tierPercent,
      prizeCount: t.prizeCount,
      tierEv: tierPrizes.reduce((s, p) => s + p.evContribution, 0),
    };
  });

  const expectedPayout = prizeRows.reduce((s, p) => s + p.evContribution, 0);

  return {
    spinPrice,
    expectedPayout,
    expectedProfit: spinPrice - expectedPayout,
    marginPercent:
      spinPrice > 0 ? ((spinPrice - expectedPayout) / spinPrice) * 100 : 0,
    tierEv,
    prizes: prizeRows,
  };
}
