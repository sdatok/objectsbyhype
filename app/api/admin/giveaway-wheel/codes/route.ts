import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createGiveawayPlayCode } from "@/lib/giveaway-wheel-codes";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      winnerName?: string;
      winnerEmail?: string;
      source?: string;
      notes?: string;
    };

    const code = await createGiveawayPlayCode({
      winnerName: body.winnerName ?? "",
      winnerEmail: body.winnerEmail,
      source: body.source,
      notes: body.notes,
    });
    return NextResponse.json(code, { status: 201 });
  } catch (err) {
    console.error("[POST /api/admin/giveaway-wheel/codes]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generate failed" },
      { status: 400 }
    );
  }
}

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.giveawayWheelPlayCode.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      spin: { select: { prizeLabel: true, createdAt: true } },
    },
  });

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      code: r.code,
      winnerName: r.winnerName,
      winnerEmail: r.winnerEmail,
      source: r.source,
      notes: r.notes,
      usedAt: r.usedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      prizeLabel: r.spin?.prizeLabel ?? null,
    }))
  );
}
