import { NextResponse } from "next/server";
import type { WheelPrizeTier } from "@prisma/client";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GIVEAWAY_WHEEL_TIERS } from "@/lib/giveaway-wheel-config";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as {
      label?: string;
      tier?: WheelPrizeTier;
      quantityRemaining?: number;
      active?: boolean;
    };

    const data: Record<string, unknown> = {};
    if (typeof body.label === "string" && body.label.trim()) {
      data.label = body.label.trim();
    }
    if (body.tier && GIVEAWAY_WHEEL_TIERS.includes(body.tier)) {
      data.tier = body.tier;
    }
    if (typeof body.quantityRemaining === "number") {
      data.quantityRemaining = Math.max(0, Math.floor(body.quantityRemaining));
    }
    if (typeof body.active === "boolean") data.active = body.active;

    const updated = await prisma.giveawayWheelPrize.update({
      where: { id },
      data,
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/admin/giveaway-wheel/prizes/[id]]", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await prisma.giveawayWheelPrize.update({
      where: { id },
      data: { active: false, quantityRemaining: 0 },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/admin/giveaway-wheel/prizes/[id]]", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
