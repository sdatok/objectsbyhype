import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { promoTypeFromString } from "@/lib/checkout";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const data: Record<string, unknown> = {};
    if ("active" in body) data.active = Boolean(body.active);
    if ("type" in body && body.type) {
      const t = promoTypeFromString(String(body.type).toUpperCase());
      if (!t) return NextResponse.json({ error: "Invalid type" }, { status: 400 });
      data.type = t;
    }
    if ("value" in body && body.value != null) data.value = body.value;
    if ("expiresAt" in body) {
      data.expiresAt =
        body.expiresAt === null || body.expiresAt === ""
          ? null
          : new Date(String(body.expiresAt));
    }
    if ("maxRedemptions" in body) {
      data.maxRedemptions =
        body.maxRedemptions === "" || body.maxRedemptions == null
          ? null
          : Number(body.maxRedemptions);
    }
    if ("perCustomerLimit" in body) {
      data.perCustomerLimit =
        body.perCustomerLimit === "" || body.perCustomerLimit == null
          ? null
          : Number(body.perCustomerLimit);
    }
    if ("minSubtotal" in body) {
      data.minSubtotal =
        body.minSubtotal === "" || body.minSubtotal == null
          ? null
          : Number(body.minSubtotal);
    }

    const row = await prisma.promoCode.update({ where: { id }, data });
    return NextResponse.json(row);
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.promoCode.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
