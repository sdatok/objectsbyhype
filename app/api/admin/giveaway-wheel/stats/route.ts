import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { buildGiveawayWheelAdminStats } from "@/lib/giveaway-wheel-spin";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = await buildGiveawayWheelAdminStats();
  return NextResponse.json(stats);
}
