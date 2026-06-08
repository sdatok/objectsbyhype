import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const spins = await prisma.giveawayWheelSpin.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(spins);
}
