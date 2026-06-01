import { prisma } from "@/lib/db";
import {
  WHEEL_CONFIG_ID,
  WHEEL_SEED_PRIZES,
  WHEEL_DEFAULT_QUANTITY,
  WHEEL_CATALOG_VERSION,
  WHEEL_RETIRED_PRIZE_LABELS,
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

async function readCatalogVersion(): Promise<number> {
  const row = await prisma.wheelPrize.findFirst({
    where: { label: "__wheel_catalog_version__" },
    select: { sortOrder: true },
  });
  return row?.sortOrder ?? 0;
}

async function writeCatalogVersion(version: number) {
  const existing = await prisma.wheelPrize.findFirst({
    where: { label: "__wheel_catalog_version__" },
  });
  if (existing) {
    await prisma.wheelPrize.update({
      where: { id: existing.id },
      data: { sortOrder: version, active: false, quantityRemaining: 0 },
    });
    return;
  }
  await prisma.wheelPrize.create({
    data: {
      label: "__wheel_catalog_version__",
      tier: "COMMON",
      sortOrder: version,
      quantityInitial: 0,
      quantityRemaining: 0,
      active: false,
    },
  });
}

function catalogKey(label: string, tier: string) {
  return `${label}\0${tier}`;
}

/** Idempotent catalog refresh from WHEEL_SEED_PRIZES. Preserves stock counts. */
export async function syncWheelPrizeCatalog() {
  await ensureWheelPrizesSeeded();

  const applied = await readCatalogVersion();
  if (applied >= WHEEL_CATALOG_VERSION) return;

  const catalogKeys = new Set(
    WHEEL_SEED_PRIZES.map((p) => catalogKey(p.label, p.tier))
  );

  await prisma.$transaction(async (tx) => {
    await tx.wheelPrize.updateMany({
      where: { label: { in: [...WHEEL_RETIRED_PRIZE_LABELS] } },
      data: { active: false, quantityRemaining: 0 },
    });

    const claimedIds = new Set<string>();

    const jackpotSc = await tx.wheelPrize.findFirst({
      where: { label: "$100 Store Credit", tier: "JACKPOT", active: true },
    });
    const rareSc = await tx.wheelPrize.findFirst({
      where: { label: "$100 Store Credit", tier: "RARE", active: true },
    });
    if (jackpotSc && rareSc) {
      await tx.wheelPrize.update({
        where: { id: jackpotSc.id },
        data: { tier: "RARE", sortOrder: 7 },
      });
      await tx.wheelPrize.update({
        where: { id: rareSc.id },
        data: { tier: "JACKPOT", sortOrder: 3 },
      });
      claimedIds.add(jackpotSc.id);
      claimedIds.add(rareSc.id);
    }

    for (const item of WHEEL_SEED_PRIZES) {
      let row = await tx.wheelPrize.findFirst({
        where: { label: item.label, tier: item.tier },
      });

      if (row && claimedIds.has(row.id)) {
        await tx.wheelPrize.update({
          where: { id: row.id },
          data: { sortOrder: item.sortOrder, active: true },
        });
        continue;
      }

      if (!row) {
        const candidate = await tx.wheelPrize.findFirst({
          where: {
            label: item.label,
            active: true,
            id: { notIn: [...claimedIds] },
          },
          orderBy: { sortOrder: "asc" },
        });

        if (candidate) {
          row = await tx.wheelPrize.update({
            where: { id: candidate.id },
            data: {
              tier: item.tier,
              sortOrder: item.sortOrder,
              active: true,
            },
          });
        } else {
          row = await tx.wheelPrize.create({
            data: {
              label: item.label,
              tier: item.tier,
              sortOrder: item.sortOrder,
              quantityInitial: WHEEL_DEFAULT_QUANTITY,
              quantityRemaining: WHEEL_DEFAULT_QUANTITY,
              active: true,
            },
          });
        }
      } else {
        row = await tx.wheelPrize.update({
          where: { id: row.id },
          data: { sortOrder: item.sortOrder, active: true },
        });
      }

      claimedIds.add(row.id);
    }

    const activeRows = await tx.wheelPrize.findMany({
      where: { active: true },
    });
    for (const row of activeRows) {
      if (row.label === "__wheel_catalog_version__") continue;
      if (!catalogKeys.has(catalogKey(row.label, row.tier))) {
        await tx.wheelPrize.update({
          where: { id: row.id },
          data: { active: false, quantityRemaining: 0 },
        });
      }
    }
  });

  await writeCatalogVersion(WHEEL_CATALOG_VERSION);
}

export async function initWheelData() {
  await getOrCreateWheelConfig();
  await ensureWheelPrizesSeeded();
  await syncWheelPrizeCatalog();
}
