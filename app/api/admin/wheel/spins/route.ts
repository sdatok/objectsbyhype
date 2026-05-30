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
  const take = Math.min(100, Math.max(1, Number(url.searchParams.get("take") ?? 50)));

  const spins = await prisma.wheelSpin.findMany({
    where: { monthKey },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      proMember: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json(spins);
}
