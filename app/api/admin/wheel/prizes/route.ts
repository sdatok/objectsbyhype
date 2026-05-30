import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureWheelPrizesSeeded } from "@/lib/wheel-db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureWheelPrizesSeeded();
  const prizes = await prisma.wheelPrize.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(prizes);
}
