import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { GAME_CONFIG_ID, getOrCreateGameConfig } from "@/lib/game-config";

export const dynamic = "force-dynamic";

/**
 * POST = force-start a new giveaway window now. Scores in the current window
 * are preserved and become "previous window" (winner shown on the home page).
 */
export async function POST() {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await getOrCreateGameConfig();
  const updated = await prisma.gameConfig.update({
    where: { id: GAME_CONFIG_ID },
    data: { windowStartedAt: new Date() },
  });
  return NextResponse.json(updated);
}
