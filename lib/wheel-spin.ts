import type { WheelPrize, WheelPrizeTier, WheelConfig } from "@prisma/client";
import { prisma } from "@/lib/db";
import { currentMonthKey } from "@/lib/wheel-config";
import { normalizeWheelCode } from "@/lib/wheel-codes";
import { getOrCreateWheelConfig, ensureWheelPrizesSeeded } from "@/lib/wheel-db";

export type WheelSpinErrorCode =
  | "INVALID_CODE"
  | "ALREADY_USED"
  | "EXPIRED_MONTH"
  | "DISABLED"
  | "POOL_EMPTY"
  | "INACTIVE_MEMBER";

export class WheelSpinError extends Error {
  code: WheelSpinErrorCode;
  constructor(code: WheelSpinErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface WheelSpinResult {
  spinId: string;
  prizeLabel: string;
  tier: WheelPrizeTier;
  monthKey: string;
}

function pickWeightedTier(
  config: WheelConfig,
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
    throw new WheelSpinError("POOL_EMPTY", "No prizes left in the wheel.");
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
  config: WheelConfig,
  prizes: WheelPrize[]
): WheelPrize {
  if (prizes.length === 0) {
    throw new WheelSpinError("POOL_EMPTY", "All prizes have been claimed.");
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

  throw new WheelSpinError("POOL_EMPTY", "No prizes available to win.");
}

export interface WheelDemoSpinResult {
  prizeLabel: string;
  tier: WheelPrizeTier;
  demo: true;
}

/** Preview spin — same odds as real spins, but nothing is claimed. */
export async function executeDemoWheelSpin(): Promise<WheelDemoSpinResult> {
  await ensureWheelPrizesSeeded();
  const config = await getOrCreateWheelConfig();
  if (!config.enabled) {
    throw new WheelSpinError("DISABLED", "Wheel of Hype is offline right now.");
  }

  const prizes = await prisma.wheelPrize.findMany({
    where: { active: true, quantityRemaining: { gt: 0 } },
  });
  const chosen = pickRandomPrize(config, prizes);

  return {
    prizeLabel: chosen.label,
    tier: chosen.tier,
    demo: true,
  };
}

export async function executeWheelSpin(
  rawCode: string,
  ip?: string | null
): Promise<WheelSpinResult> {
  await ensureWheelPrizesSeeded();
  const config = await getOrCreateWheelConfig();
  if (!config.enabled) {
    throw new WheelSpinError("DISABLED", "Wheel of Hype is offline right now.");
  }

  const code = normalizeWheelCode(rawCode);
  if (!code || code.length < 8) {
    throw new WheelSpinError("INVALID_CODE", "That code doesn't look valid.");
  }

  const monthKey = currentMonthKey();

  return prisma.$transaction(async (tx) => {
    const playCode = await tx.wheelPlayCode.findUnique({
      where: { code },
      include: { proMember: true },
    });

    if (!playCode) {
      throw new WheelSpinError("INVALID_CODE", "Code not found.");
    }
    if (!playCode.proMember.active) {
      throw new WheelSpinError("INACTIVE_MEMBER", "This membership is inactive.");
    }
    if (playCode.monthKey !== monthKey) {
      throw new WheelSpinError(
        "EXPIRED_MONTH",
        "This code is for a different month. Request a new code for this month."
      );
    }
    if (playCode.usedAt) {
      throw new WheelSpinError(
        "ALREADY_USED",
        "This code was already used for your monthly spin."
      );
    }

    const prizes = await tx.wheelPrize.findMany({
      where: { active: true, quantityRemaining: { gt: 0 } },
    });

    const chosen = pickRandomPrize(config, prizes);

    const updatedPrize = await tx.wheelPrize.updateMany({
      where: {
        id: chosen.id,
        quantityRemaining: { gt: 0 },
      },
      data: {
        quantityRemaining: { decrement: 1 },
      },
    });
    if (updatedPrize.count !== 1) {
      throw new WheelSpinError("POOL_EMPTY", "Prize was just claimed. Try again.");
    }

    const spin = await tx.wheelSpin.create({
      data: {
        codeId: playCode.id,
        proMemberId: playCode.proMemberId,
        prizeId: chosen.id,
        prizeLabel: chosen.label,
        tier: chosen.tier,
        monthKey,
        ip: ip ?? null,
      },
    });

    const markUsed = await tx.wheelPlayCode.updateMany({
      where: { id: playCode.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (markUsed.count !== 1) {
      throw new WheelSpinError(
        "ALREADY_USED",
        "This code was already used for your monthly spin."
      );
    }

    return {
      spinId: spin.id,
      prizeLabel: spin.prizeLabel,
      tier: spin.tier,
      monthKey: spin.monthKey,
    };
  });
}

export async function validateWheelCode(rawCode: string) {
  await ensureWheelPrizesSeeded();
  const config = await getOrCreateWheelConfig();
  if (!config.enabled) {
    return { ok: false as const, error: "DISABLED" as const };
  }

  const code = normalizeWheelCode(rawCode);
  const playCode = await prisma.wheelPlayCode.findUnique({
    where: { code },
    include: { proMember: { select: { name: true, active: true } } },
  });
  if (!playCode) return { ok: false as const, error: "INVALID_CODE" as const };
  if (!playCode.proMember.active) {
    return { ok: false as const, error: "INACTIVE_MEMBER" as const };
  }
  if (playCode.monthKey !== currentMonthKey()) {
    return { ok: false as const, error: "EXPIRED_MONTH" as const };
  }
  if (playCode.usedAt) {
    return { ok: false as const, error: "ALREADY_USED" as const };
  }
  return {
    ok: true as const,
    memberName: playCode.proMember.name,
    monthKey: playCode.monthKey,
  };
}

export async function buildPublicWheelState() {
  await ensureWheelPrizesSeeded();
  const config = await getOrCreateWheelConfig();
  const monthKey = currentMonthKey();

  const prizes = await prisma.wheelPrize.findMany({
    where: { active: true, quantityRemaining: { gt: 0 } },
    select: { label: true, tier: true, quantityRemaining: true },
    orderBy: { sortOrder: "asc" },
  });

  const remainingByTier = {
    COMMON: 0,
    RARE: 0,
    JACKPOT: 0,
  };
  for (const p of prizes) {
    remainingByTier[p.tier] += p.quantityRemaining;
  }

  return {
    enabled: config.enabled,
    monthKey,
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

/** Undo a spin: restore prize stock, free the code, delete the spin row. */
export async function revertWheelSpin(spinId: string) {
  return prisma.$transaction(async (tx) => {
    const spin = await tx.wheelSpin.findUnique({
      where: { id: spinId },
      select: { id: true, codeId: true, prizeId: true },
    });
    if (!spin) {
      throw new WheelSpinError("INVALID_CODE", "Spin not found.");
    }

    await tx.wheelPrize.update({
      where: { id: spin.prizeId },
      data: { quantityRemaining: { increment: 1 } },
    });

    await tx.wheelPlayCode.update({
      where: { id: spin.codeId },
      data: { usedAt: null },
    });

    await tx.wheelSpin.delete({ where: { id: spinId } });
  });
}

export async function buildWheelAdminStats(monthKey = currentMonthKey()) {
  const [activeMembers, mrrAgg, codesIssued, codesUsed, spinsThisMonth, prizes] =
    await Promise.all([
      prisma.wheelProMember.count({ where: { active: true } }),
      prisma.wheelProMember.aggregate({
        where: { active: true },
        _sum: { monthlyPrice: true },
      }),
      prisma.wheelPlayCode.count({ where: { monthKey } }),
      prisma.wheelPlayCode.count({ where: { monthKey, usedAt: { not: null } } }),
      prisma.wheelSpin.count({ where: { monthKey } }),
      prisma.wheelPrize.findMany({ orderBy: { sortOrder: "asc" } }),
    ]);

  const remainingByTier = { COMMON: 0, RARE: 0, JACKPOT: 0 };
  for (const p of prizes) {
    if (p.active && p.quantityRemaining > 0) {
      remainingByTier[p.tier] += p.quantityRemaining;
    }
  }

  return {
    monthKey,
    activeMembers,
    mrrTotal: Number(mrrAgg._sum.monthlyPrice ?? 0),
    codesIssued,
    codesUnused: codesIssued - codesUsed,
    spinsThisMonth,
    remainingByTier,
    totalPrizesRemaining: prizes.reduce(
      (s, p) => s + (p.active ? p.quantityRemaining : 0),
      0
    ),
  };
}
