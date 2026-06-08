import { NextResponse } from "next/server";
import type { WheelPrizeTier } from "@prisma/client";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureGiveawayWheelPrizesSeeded } from "@/lib/giveaway-wheel-db";
import { GIVEAWAY_WHEEL_TIERS } from "@/lib/giveaway-wheel-config";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureGiveawayWheelPrizesSeeded();
  const prizes = await prisma.giveawayWheelPrize.findMany({
    where: { label: { not: "__giveaway_catalog_version__" } },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(prizes);
}

export async function POST(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      label?: string;
      tier?: WheelPrizeTier;
      quantity?: number;
    };

    const label = body.label?.trim();
    if (!label) {
      return NextResponse.json({ error: "Label is required" }, { status: 400 });
    }
    if (!body.tier || !GIVEAWAY_WHEEL_TIERS.includes(body.tier)) {
      return NextResponse.json({ error: "Valid tier is required" }, { status: 400 });
    }

    const quantity = Math.max(1, Math.floor(body.quantity ?? 1));
    const maxSort = await prisma.giveawayWheelPrize.aggregate({
      _max: { sortOrder: true },
    });

    const prize = await prisma.giveawayWheelPrize.create({
      data: {
        label,
        tier: body.tier,
        quantityInitial: quantity,
        quantityRemaining: quantity,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        active: true,
      },
    });

    return NextResponse.json(prize, { status: 201 });
  } catch (err) {
    console.error("[POST /api/admin/giveaway-wheel/prizes]", err);
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}
