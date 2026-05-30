import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  bulkGenerateCodesForMonth,
  createPlayCodeForMember,
} from "@/lib/wheel-codes";
import { currentMonthKey } from "@/lib/wheel-config";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      proMemberId?: string;
      bulk?: boolean;
      monthKey?: string;
    };

    const monthKey = body.monthKey?.trim() || currentMonthKey();

    if (body.bulk) {
      const created = await bulkGenerateCodesForMonth(monthKey);
      return NextResponse.json({ created, monthKey, count: created.length });
    }

    if (!body.proMemberId) {
      return NextResponse.json(
        { error: "proMemberId or bulk=true required" },
        { status: 400 }
      );
    }

    const member = await prisma.wheelProMember.findUnique({
      where: { id: body.proMemberId },
    });
    if (!member || !member.active) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const code = await createPlayCodeForMember(body.proMemberId, monthKey);
    return NextResponse.json(code);
  } catch (err) {
    console.error("[POST /api/admin/wheel/codes/generate]", err);
    return NextResponse.json({ error: "Generate failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const monthKey = url.searchParams.get("month") ?? currentMonthKey();

  const rows = await prisma.wheelPlayCode.findMany({
    where: { monthKey },
    include: {
      proMember: { select: { name: true, email: true, active: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const csvHeader = "name,email,code,monthKey,used\n";
  const csvBody = rows
    .map((r) => {
      const cols = [
        r.proMember.name,
        r.proMember.email,
        r.code,
        r.monthKey,
        r.usedAt ? "yes" : "no",
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
      return cols.join(",");
    })
    .join("\n");

  return new NextResponse(csvHeader + csvBody, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wheel-codes-${monthKey}.csv"`,
    },
  });
}
