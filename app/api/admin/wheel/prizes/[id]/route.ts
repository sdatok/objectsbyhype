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
