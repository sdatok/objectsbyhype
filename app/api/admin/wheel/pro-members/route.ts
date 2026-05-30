import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currentMonthKey } from "@/lib/wheel-config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const monthKey = url.searchParams.get("month") ?? currentMonthKey();

  const members = await prisma.wheelProMember.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      codes: {
        where: { monthKey },
        take: 1,
      },
    },
  });

  return NextResponse.json(
    members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      monthlyPrice: Number(m.monthlyPrice),
      active: m.active,
      notes: m.notes,
      createdAt: m.createdAt,
      code: m.codes[0]?.code ?? null,
      codeUsed: !!m.codes[0]?.usedAt,
      codeUsedAt: m.codes[0]?.usedAt ?? null,
    }))
  );
}

export async function POST(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      monthlyPrice?: number;
      notes?: string;
    };

    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const monthlyPrice = Number(body.monthlyPrice);

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0) {
      return NextResponse.json(
        { error: "Monthly price must be a non-negative number" },
        { status: 400 }
      );
    }

    const member = await prisma.wheelProMember.create({
      data: {
        name: name.slice(0, 80),
        email: email.slice(0, 200),
        monthlyPrice,
        notes: body.notes?.trim().slice(0, 500) || null,
      },
    });

    return NextResponse.json({
      ...member,
      monthlyPrice: Number(member.monthlyPrice),
    });
  } catch (err) {
    console.error("[POST /api/admin/wheel/pro-members]", err);
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}
