import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
      active?: boolean;
      quantityRemaining?: number;
    };

    const data: Record<string, unknown> = {};
    if (typeof body.active === "boolean") data.active = body.active;
    if (typeof body.quantityRemaining === "number") {
      const n = Math.max(0, Math.floor(body.quantityRemaining));
      data.quantityRemaining = n;
    }

    const updated = await prisma.wheelPrize.update({
      where: { id },
      data,
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/admin/wheel/prizes/[id]]", err);
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
    const spinCount = await prisma.wheelSpin.count({ where: { prizeId: id } });

    if (spinCount > 0) {
      const updated = await prisma.wheelPrize.update({
        where: { id },
        data: { active: false, quantityRemaining: 0 },
      });
      return NextResponse.json({ removed: "deactivated", prize: updated });
    }

    await prisma.wheelPrize.delete({ where: { id } });
    return NextResponse.json({ removed: "deleted" });
  } catch (err) {
    console.error("[DELETE /api/admin/wheel/prizes/[id]]", err);
    return NextResponse.json({ error: "Remove failed" }, { status: 500 });
  }
}
