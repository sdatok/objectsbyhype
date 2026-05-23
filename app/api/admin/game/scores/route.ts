import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Admin view: full leaderboard with un-masked emails so the admin can actually
 * contact the winner. Returns the current window's scores plus the previous
 * three closed windows for historical context.
 */
export async function GET() {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Distinct window-start timestamps, most recent first, take 4.
  const distinctWindows = await prisma.gameScore.findMany({
    distinct: ["windowStartedAt"],
    orderBy: { windowStartedAt: "desc" },
    select: { windowStartedAt: true },
    take: 4,
  });

  const buckets = await Promise.all(
    distinctWindows.map(async (w) => {
      const scores = await prisma.gameScore.findMany({
        where: { windowStartedAt: w.windowStartedAt },
        orderBy: [
          { score: "desc" },
          { secondsPlayed: "asc" },
          { createdAt: "asc" },
        ],
        take: 25,
      });
      return {
        windowStartedAt: w.windowStartedAt.toISOString(),
        scores: scores.map((s) => ({
          id: s.id,
          email: s.email,
          displayName: s.displayName,
          score: s.score,
          secondsPlayed: s.secondsPlayed,
          createdAt: s.createdAt.toISOString(),
        })),
      };
    })
  );

  return NextResponse.json({ windows: buckets });
}
