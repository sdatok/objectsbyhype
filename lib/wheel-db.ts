import { prisma } from "@/lib/db";
import {
  WHEEL_CONFIG_ID,
  WHEEL_SEED_PRIZES,
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
      quantityInitial: 1,
      quantityRemaining: 1,
      active: true,
    })),
  });
}

export async function initWheelData() {
  await getOrCreateWheelConfig();
  await ensureWheelPrizesSeeded();
}
