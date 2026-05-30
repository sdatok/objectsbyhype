import { prisma } from "@/lib/db";
import {
  WHEEL_CONFIG_ID,
  WHEEL_SEED_PRIZES,
  WHEEL_DEFAULT_QUANTITY,
  DEFAULT_TIER_WEIGHTS,
} from "@/lib/wheel-config";

export async function getOrCreateWheelConfig() {
  const existing = await prisma.wheelConfig.findUnique({
    where: { id: WHEEL_CONFIG_ID },
  });
  if (existing) return existing;

  return prisma.wheelConfig.create({
    data: {
      id: WHEEL_CONFIG_ID,
      enabled: true,
      ...DEFAULT_TIER_WEIGHTS,
    },
  });
}

export async function ensureWheelPrizesSeeded() {
  const count = await prisma.wheelPrize.count();
  if (count > 0) return;

  await prisma.wheelPrize.createMany({
    data: WHEEL_SEED_PRIZES.map((p) => ({
      label: p.label,
      tier: p.tier,
      sortOrder: p.sortOrder,
      quantityInitial: WHEEL_DEFAULT_QUANTITY,
      quantityRemaining: WHEEL_DEFAULT_QUANTITY,
      active: true,
    })),
  });
}

async function catalogNeedsSync(): Promise<boolean> {
  const [chrome, bundle, jackpotCredit, commonCredit] = await Promise.all([
    prisma.wheelPrize.findFirst({
      where: { label: "Chrome Hearts Glasses" },
      select: { tier: true },
    }),
    prisma.wheelPrize.findFirst({
      where: { label: "$100 OBH Bundle" },
      select: { id: true },
    }),
    prisma.wheelPrize.findFirst({
      where: { label: "$100 Store Credit", tier: "JACKPOT" },
      select: { id: true },
    }),
    prisma.wheelPrize.findFirst({
      where: { label: "$25 Store Credit", tier: "COMMON" },
      select: { id: true },
    }),
  ]);

  return (
    chrome?.tier === "JACKPOT" ||
    !bundle ||
    !jackpotCredit ||
    !!commonCredit
  );
}

/** Idempotent catalog refresh — tiers, new prizes, stock = 5. */
export async function syncWheelPrizeCatalog() {
  await ensureWheelPrizesSeeded();
  if (!(await catalogNeedsSync())) return;

  await prisma.$transaction(async (tx) => {
    await tx.wheelPrize.updateMany({
      where: { label: "Chrome Hearts Glasses" },
      data: { tier: "RARE", active: true },
    });

    await tx.wheelPrize.updateMany({
      where: {
        label: {
          in: [
            "$100 Store Credit",
            "$75 Store Credit",
            "$50 Store Credit",
            "$25 Store Credit",
          ],
        },
        tier: "COMMON",
      },
      data: { tier: "RARE", active: true },
    });

    const jackpotStoreCredit = await tx.wheelPrize.findFirst({
      where: { label: "$100 Store Credit", tier: "JACKPOT" },
    });
    if (!jackpotStoreCredit) {
      await tx.wheelPrize.create({
        data: {
          label: "$100 Store Credit",
          tier: "JACKPOT",
          sortOrder: 6,
          quantityInitial: WHEEL_DEFAULT_QUANTITY,
          quantityRemaining: WHEEL_DEFAULT_QUANTITY,
          active: true,
        },
      });
    }

    for (const item of [
      { label: "$100 OBH Bundle", sortOrder: 24 },
      { label: "$150 OBH Bundle", sortOrder: 25 },
      { label: "$200 OBH Bundle", sortOrder: 26 },
    ]) {
      const existing = await tx.wheelPrize.findFirst({
        where: { label: item.label },
      });
      if (existing) {
        await tx.wheelPrize.update({
          where: { id: existing.id },
          data: {
            tier: "RARE",
            sortOrder: item.sortOrder,
            active: true,
          },
        });
      } else {
        await tx.wheelPrize.create({
          data: {
            label: item.label,
            tier: "RARE",
            sortOrder: item.sortOrder,
            quantityInitial: WHEEL_DEFAULT_QUANTITY,
            quantityRemaining: WHEEL_DEFAULT_QUANTITY,
            active: true,
          },
        });
      }
    }

    for (const item of WHEEL_SEED_PRIZES) {
      const rows = await tx.wheelPrize.findMany({
        where: { label: item.label, tier: item.tier },
      });
      if (rows.length === 0) continue;

      const keep = rows.sort((a, b) => a.sortOrder - b.sortOrder)[0]!;
      await tx.wheelPrize.update({
        where: { id: keep.id },
        data: {
          sortOrder: item.sortOrder,
          quantityInitial: WHEEL_DEFAULT_QUANTITY,
          quantityRemaining: WHEEL_DEFAULT_QUANTITY,
          active: true,
        },
      });

      for (const dup of rows.slice(1)) {
        await tx.wheelPrize.update({
          where: { id: dup.id },
          data: { active: false, quantityRemaining: 0 },
        });
      }
    }

    await tx.wheelPrize.updateMany({
      where: { active: true },
      data: {
        quantityInitial: WHEEL_DEFAULT_QUANTITY,
        quantityRemaining: WHEEL_DEFAULT_QUANTITY,
      },
    });
  });
}

export async function initWheelData() {
  await getOrCreateWheelConfig();
  await ensureWheelPrizesSeeded();
  await syncWheelPrizeCatalog();
}
