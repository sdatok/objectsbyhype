import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getOrCreateGameConfig } from "@/lib/game-config";

export const dynamic = "force-dynamic";

/**
 * Wipes every GameScore row tied to the *current* giveaway window.
 * Previous windows are left intact so historical winners stay visible
 * in the admin "Recent windows" list. Admin-only.
 */
export async function POST() {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getOrCreateGameConfig();
  const result = await prisma.gameScore.deleteMany({
    where: { windowStartedAt: config.windowStartedAt },
  });

  return NextResponse.json({ ok: true, deleted: result.count });
}
