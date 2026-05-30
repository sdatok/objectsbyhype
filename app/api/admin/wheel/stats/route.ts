import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildWheelAdminStats } from "@/lib/wheel-spin";
import { getOrCreateWheelConfig } from "@/lib/wheel-db";
import { currentMonthKey } from "@/lib/wheel-config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const monthKey = url.searchParams.get("month") ?? currentMonthKey();
  const stats = await buildWheelAdminStats(monthKey);
  const config = await getOrCreateWheelConfig();
  return NextResponse.json({ stats, config });
}
