import { prisma } from "@/lib/db";
import {
  GIVEAWAY_WHEEL_CONFIG_ID,
  GIVEAWAY_WHEEL_DEFAULT_QUANTITY,
  GIVEAWAY_WHEEL_SEED_PRIZES,
  DEFAULT_GIVEAWAY_TIER_WEIGHTS,
} from "@/lib/giveaway-wheel-config";

export async function getOrCreateGiveawayWheelConfig() {
  const existing = await prisma.giveawayWheelConfig.findUnique({
    where: { id: GIVEAWAY_WHEEL_CONFIG_ID },
  });
  if (existing) return existing;

  return prisma.giveawayWheelConfig.create({
    data: {
      id: GIVEAWAY_WHEEL_CONFIG_ID,
      enabled: false,
      ...DEFAULT_GIVEAWAY_TIER_WEIGHTS,
    },
  });
}

export async function ensureGiveawayWheelPrizesSeeded() {
  const count = await prisma.giveawayWheelPrize.count({
    where: { label: { not: "__giveaway_catalog_version__" } },
  });
  if (count > 0) return;

  await prisma.giveawayWheelPrize.createMany({
    data: GIVEAWAY_WHEEL_SEED_PRIZES.map((p) => ({
      label: p.label,
      tier: p.tier,
      sortOrder: p.sortOrder,
      quantityInitial: GIVEAWAY_WHEEL_DEFAULT_QUANTITY,
      quantityRemaining: GIVEAWAY_WHEEL_DEFAULT_QUANTITY,
      active: true,
    })),
  });
}

async function readCatalogVersion(): Promise<number> {
  const row = await prisma.giveawayWheelPrize.findFirst({
    where: { label: "__giveaway_catalog_version__" },
    select: { sortOrder: true },
  });
  return row?.sortOrder ?? 0;
}

async function writeCatalogVersion(version: number) {
  const existing = await prisma.giveawayWheelPrize.findFirst({
    where: { label: "__giveaway_catalog_version__" },
  });
  if (existing) {
    await prisma.giveawayWheelPrize.update({
      where: { id: existing.id },
      data: { sortOrder: version, active: false, quantityRemaining: 0 },
    });
    return;
  }
  await prisma.giveawayWheelPrize.create({
    data: {
      label: "__giveaway_catalog_version__",
      tier: "COMMON",
      sortOrder: version,
      quantityInitial: 0,
      quantityRemaining: 0,
      active: false,
    },
  });
}

export async function syncGiveawayWheelPrizeCatalog() {
  await ensureGiveawayWheelPrizesSeeded();

  const { GIVEAWAY_WHEEL_CATALOG_VERSION } = await import(
    "@/lib/giveaway-wheel-config"
  );
  const applied = await readCatalogVersion();
  if (applied >= GIVEAWAY_WHEEL_CATALOG_VERSION) return;

  if (applied < 2) {
    await prisma.giveawayWheelPrize.updateMany({
      where: { label: "Slime PRO (1 Week)" },
      data: { active: false, quantityRemaining: 0 },
    });

    const sortMigration: Record<number, number> = {
      10: 9,
      11: 10,
      12: 11,
      13: 12,
      14: 13,
    };
    for (const [from, to] of Object.entries(sortMigration)) {
      await prisma.giveawayWheelPrize.updateMany({
        where: {
          sortOrder: Number(from),
          active: true,
          label: { not: "__giveaway_catalog_version__" },
        },
        data: { sortOrder: to },
      });
    }

    await prisma.giveawayWheelPrize.updateMany({
      where: {
        active: true,
        label: { not: "__giveaway_catalog_version__" },
      },
      data: { tier: "RARE" },
    });
  }

  const existing = await prisma.giveawayWheelPrize.findMany({
    where: { active: true, label: { not: "__giveaway_catalog_version__" } },
  });
  const bySort = new Map(existing.map((p) => [p.sortOrder, p]));
  const validSortOrders = new Set(
    GIVEAWAY_WHEEL_SEED_PRIZES.map((p) => p.sortOrder)
  );

  for (const item of GIVEAWAY_WHEEL_SEED_PRIZES) {
    const row = bySort.get(item.sortOrder);
    if (row) {
      await prisma.giveawayWheelPrize.update({
        where: { id: row.id },
        data: { label: item.label, tier: item.tier, active: true },
      });
    } else {
      await prisma.giveawayWheelPrize.create({
        data: {
          label: item.label,
          tier: item.tier,
          sortOrder: item.sortOrder,
          quantityInitial: GIVEAWAY_WHEEL_DEFAULT_QUANTITY,
          quantityRemaining: GIVEAWAY_WHEEL_DEFAULT_QUANTITY,
          active: true,
        },
      });
    }
  }

  await prisma.giveawayWheelPrize.updateMany({
    where: {
      active: true,
      label: { not: "__giveaway_catalog_version__" },
      sortOrder: { notIn: [...validSortOrders] },
    },
    data: { active: false },
  });

  await writeCatalogVersion(GIVEAWAY_WHEEL_CATALOG_VERSION);
}

export async function initGiveawayWheelData() {
  await getOrCreateGiveawayWheelConfig();
  await ensureGiveawayWheelPrizesSeeded();
  await syncGiveawayWheelPrizeCatalog();
}
