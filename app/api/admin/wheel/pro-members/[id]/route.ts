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
      name?: string;
      email?: string;
      monthlyPrice?: number;
      active?: boolean;
      notes?: string | null;
    };

    const data: Record<string, unknown> = {};
    if (typeof body.name === "string") {
      const t = body.name.trim();
      if (t) data.name = t.slice(0, 80);
    }
    if (body.email !== undefined) {
      const t = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      data.email = t ? t.slice(0, 200) : "";
    }
    if (typeof body.monthlyPrice === "number" && body.monthlyPrice >= 0) {
      data.monthlyPrice = body.monthlyPrice;
    }
    if (typeof body.active === "boolean") data.active = body.active;
    if (body.notes !== undefined) {
      data.notes =
        typeof body.notes === "string" ? body.notes.trim().slice(0, 500) || null : null;
    }

    const updated = await prisma.wheelProMember.update({
      where: { id },
      data,
    });
    return NextResponse.json({
      ...updated,
      monthlyPrice: Number(updated.monthlyPrice),
    });
  } catch (err) {
    console.error("[PATCH /api/admin/wheel/pro-members/[id]]", err);
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
    await prisma.wheelProMember.update({
      where: { id },
      data: { active: false },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/admin/wheel/pro-members/[id]]", err);
    return NextResponse.json({ error: "Deactivate failed" }, { status: 500 });
  }
}
