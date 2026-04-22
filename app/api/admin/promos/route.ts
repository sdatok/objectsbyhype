import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { promoTypeFromString } from "@/lib/checkout";

export const dynamic = "force-dynamic";

export async function GET() {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const promos = await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(promos);
}

export async function POST(request: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const {
      code,
      type,
      value,
      active,
      expiresAt,
      maxRedemptions,
      perCustomerLimit,
      minSubtotal,
    } = body;

    if (!code || !type || value == null) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const promoType = promoTypeFromString(String(type).toUpperCase());
    if (!promoType) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const normalized = String(code).trim().toUpperCase();
    const row = await prisma.promoCode.create({
      data: {
        code: normalized,
        type: promoType,
        value,
        active: active !== false,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxRedemptions:
          maxRedemptions === "" || maxRedemptions == null
            ? null
            : Number(maxRedemptions),
        perCustomerLimit:
          perCustomerLimit === "" || perCustomerLimit == null
            ? null
            : Number(perCustomerLimit),
        minSubtotal:
          minSubtotal === "" || minSubtotal == null ? null : Number(minSubtotal),
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create promo" }, { status: 500 });
  }
}
