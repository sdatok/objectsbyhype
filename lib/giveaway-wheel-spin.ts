import type {
  GiveawayWheelConfig,
  GiveawayWheelPrize,
  WheelPrizeTier,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  GIVEAWAY_WHEEL_SPIN_AGAIN_LABEL,
} from "@/lib/giveaway-wheel-config";
import {
  createGiveawayPlayCode,
  normalizeGiveawayWheelCode,
} from "@/lib/giveaway-wheel-codes";
import {
  getOrCreateGiveawayWheelConfig,
  ensureGiveawayWheelPrizesSeeded,
} from "@/lib/giveaway-wheel-db";

export type GiveawayWheelSpinErrorCode =
  | "INVALID_CODE"
  | "ALREADY_USED"
  | "DISABLED"
  | "POOL_EMPTY";

export class GiveawayWheelSpinError extends Error {
  code: GiveawayWheelSpinErrorCode;
  constructor(code: GiveawayWheelSpinErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface GiveawayWheelSpinResult {
  spinId: string;
  prizeLabel: string;
  tier: WheelPrizeTier;
  winnerName: string;
  bonusCode?: string;
}

function pickWeightedTier(
  config: GiveawayWheelConfig,
  available: Set<WheelPrizeTier>
): WheelPrizeTier {
  const weights: Array<{ tier: WheelPrizeTier; w: number }> = [];
  if (available.has("COMMON") && config.commonWeight > 0) {
    weights.push({ tier: "COMMON", w: config.commonWeight });
  }
  if (available.has("RARE") && config.rareWeight > 0) {
    weights.push({ tier: "RARE", w: config.rareWeight });
  }
  if (available.has("JACKPOT") && config.jackpotWeight > 0) {
    weights.push({ tier: "JACKPOT", w: config.jackpotWeight });
  }
  if (weights.length === 0) {
    throw new GiveawayWheelSpinError("POOL_EMPTY", "No prizes left on the wheel.");
  }

  const total = weights.reduce((s, x) => s + x.w, 0);
  let roll = Math.random() * total;
  for (const entry of weights) {
    roll -= entry.w;
    if (roll <= 0) return entry.tier;
  }
  return weights[weights.length - 1]!.tier;
}

function pickRandomPrize(
  config: GiveawayWheelConfig,
  prizes: GiveawayWheelPrize[]
): GiveawayWheelPrize {
  if (prizes.length === 0) {
    throw new GiveawayWheelSpinError("POOL_EMPTY", "All prizes have been claimed.");
  }

  const availableTiers = new Set<WheelPrizeTier>();
  for (const p of prizes) {
    if (p.quantityRemaining > 0) availableTiers.add(p.tier);
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const tier = pickWeightedTier(config, availableTiers);
    const pool = prizes.filter(
      (p) => p.tier === tier && p.active && p.quantityRemaining > 0
    );
    if (pool.length === 0) {
      availableTiers.delete(tier);
      continue;
    }
    return pool[Math.floor(Math.random() * pool.length)]!;
  }

  throw new GiveawayWheelSpinError("POOL_EMPTY", "No prizes available to win.");
}

export async function executeGiveawayWheelSpin(
  rawCode: string,
  ip?: string | null
): Promise<GiveawayWheelSpinResult> {
  await ensureGiveawayWheelPrizesSeeded();
  const config = await getOrCreateGiveawayWheelConfig();
  if (!config.enabled) {
    throw new GiveawayWheelSpinError(
      "DISABLED",
      "Giveaway wheel is offline right now."
    );
  }

  const code = normalizeGiveawayWheelCode(rawCode);
  if (!code || code.length < 8) {
    throw new GiveawayWheelSpinError("INVALID_CODE", "That code doesn't look valid.");
  }

  const spinResult = await prisma.$transaction(async (tx) => {
    const playCode = await tx.giveawayWheelPlayCode.findUnique({
      where: { code },
    });

    if (!playCode) {
      throw new GiveawayWheelSpinError("INVALID_CODE", "Code not found.");
    }
    if (playCode.usedAt) {
      throw new GiveawayWheelSpinError(
        "ALREADY_USED",
        "This code was already used."
      );
    }

    const prizes = await tx.giveawayWheelPrize.findMany({
      where: {
        active: true,
        quantityRemaining: { gt: 0 },
        label: { not: "__giveaway_catalog_version__" },
      },
    });

    const chosen = pickRandomPrize(config, prizes);

    const updatedPrize = await tx.giveawayWheelPrize.updateMany({
      where: {
        id: chosen.id,
        quantityRemaining: { gt: 0 },
      },
      data: {
        quantityRemaining: { decrement: 1 },
      },
    });
    if (updatedPrize.count !== 1) {
      throw new GiveawayWheelSpinError(
        "POOL_EMPTY",
        "Prize was just claimed. Try again."
      );
    }

    const spin = await tx.giveawayWheelSpin.create({
      data: {
        codeId: playCode.id,
        prizeId: chosen.id,
        prizeLabel: chosen.label,
        tier: chosen.tier,
        winnerName: playCode.winnerName,
        winnerEmail: playCode.winnerEmail,
        ip: ip ?? null,
      },
    });

    const markUsed = await tx.giveawayWheelPlayCode.updateMany({
      where: { id: playCode.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (markUsed.count !== 1) {
      throw new GiveawayWheelSpinError(
        "ALREADY_USED",
        "This code was already used."
      );
    }

    return {
      spin,
      playCode,
      chosen,
    };
  });

  let bonusCode: string | undefined;
  if (spinResult.chosen.label === GIVEAWAY_WHEEL_SPIN_AGAIN_LABEL) {
    const bonus = await createGiveawayPlayCode({
      winnerName: spinResult.playCode.winnerName,
      winnerEmail: spinResult.playCode.winnerEmail,
      source: spinResult.playCode.source,
      notes: "Bonus spin from Spin Again prize",
    });
    bonusCode = bonus.code;
  }

  return {
    spinId: spinResult.spin.id,
    prizeLabel: spinResult.spin.prizeLabel,
    tier: spinResult.spin.tier,
    winnerName: spinResult.spin.winnerName,
    bonusCode,
  };
}

export async function validateGiveawayWheelCode(rawCode: string) {
  await ensureGiveawayWheelPrizesSeeded();
  const config = await getOrCreateGiveawayWheelConfig();
  if (!config.enabled) {
    return { ok: false as const, error: "DISABLED" as const };
  }

  const code = normalizeGiveawayWheelCode(rawCode);
  const playCode = await prisma.giveawayWheelPlayCode.findUnique({
    where: { code },
  });
  if (!playCode) return { ok: false as const, error: "INVALID_CODE" as const };
  if (playCode.usedAt) {
    return { ok: false as const, error: "ALREADY_USED" as const };
  }
  return {
    ok: true as const,
    winnerName: playCode.winnerName,
    source: playCode.source,
  };
}

export async function buildPublicGiveawayWheelState() {
  await ensureGiveawayWheelPrizesSeeded();
  const config = await getOrCreateGiveawayWheelConfig();

  const prizes = await prisma.giveawayWheelPrize.findMany({
    where: {
      active: true,
      quantityRemaining: { gt: 0 },
      label: { not: "__giveaway_catalog_version__" },
    },
    select: { label: true, tier: true, quantityRemaining: true },
    orderBy: { sortOrder: "asc" },
  });

  const remainingByTier = { COMMON: 0, RARE: 0, JACKPOT: 0 };
  for (const p of prizes) {
    remainingByTier[p.tier] += p.quantityRemaining;
  }

  return {
    enabled: config.enabled,
    remainingByTier,
    totalRemaining: prizes.reduce((s, p) => s + p.quantityRemaining, 0),
    tierWeights: {
      common: config.commonWeight,
      rare: config.rareWeight,
      jackpot: config.jackpotWeight,
    },
    prizes: prizes.map((p) => ({ label: p.label, tier: p.tier })),
  };
}

export async function revertGiveawayWheelSpin(spinId: string) {
  return prisma.$transaction(async (tx) => {
    const spin = await tx.giveawayWheelSpin.findUnique({
      where: { id: spinId },
      select: { id: true, codeId: true, prizeId: true },
    });
    if (!spin) {
      throw new GiveawayWheelSpinError("INVALID_CODE", "Spin not found.");
    }

    await tx.giveawayWheelPrize.update({
      where: { id: spin.prizeId },
      data: { quantityRemaining: { increment: 1 } },
    });

    await tx.giveawayWheelPlayCode.update({
      where: { id: spin.codeId },
      data: { usedAt: null },
    });

    await tx.giveawayWheelSpin.delete({ where: { id: spinId } });
  });
}

export async function buildGiveawayWheelAdminStats() {
  const [codesIssued, codesUsed, spinsTotal, prizes] = await Promise.all([
    prisma.giveawayWheelPlayCode.count(),
    prisma.giveawayWheelPlayCode.count({ where: { usedAt: { not: null } } }),
    prisma.giveawayWheelSpin.count(),
    prisma.giveawayWheelPrize.findMany({
      where: { label: { not: "__giveaway_catalog_version__" } },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const remainingByTier = { COMMON: 0, RARE: 0, JACKPOT: 0 };
  for (const p of prizes) {
    if (p.active && p.quantityRemaining > 0) {
      remainingByTier[p.tier] += p.quantityRemaining;
    }
  }

  return {
    codesIssued,
    codesUnused: codesIssued - codesUsed,
    spinsTotal,
    remainingByTier,
    totalPrizesRemaining: prizes.reduce(
      (s, p) => s + (p.active ? p.quantityRemaining : 0),
      0
    ),
  };
}
