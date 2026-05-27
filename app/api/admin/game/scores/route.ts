import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getOrCreateGameConfig } from "@/lib/game-config";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_SECONDS = 0;
const MAX_SECONDS = 60 * 60;

interface AdminScoreBody {
  email?: string;
  displayName?: string;
  score?: number;
  secondsPlayed?: number;
}

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

/** Manually add or update a score in the current giveaway window. */
export async function POST(request: Request) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as AdminScoreBody;

    const email = (body.email ?? "").trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
    }

    const score = Math.floor(Number(body.score));
    if (!Number.isFinite(score) || score < 0) {
      return NextResponse.json({ error: "Invalid score." }, { status: 400 });
    }

    const secondsPlayed = Math.floor(Number(body.secondsPlayed ?? 0));
    if (
      !Number.isFinite(secondsPlayed) ||
      secondsPlayed < MIN_SECONDS ||
      secondsPlayed > MAX_SECONDS
    ) {
      return NextResponse.json({ error: "Invalid time (seconds)." }, { status: 400 });
    }

    const displayNameRaw = (body.displayName ?? "").trim();
    const displayName = displayNameRaw ? displayNameRaw.slice(0, 32) : null;

    const config = await getOrCreateGameConfig();

    const existing = await prisma.gameScore.findFirst({
      where: { email, windowStartedAt: config.windowStartedAt },
    });

    const saved = existing
      ? await prisma.gameScore.update({
          where: { id: existing.id },
          data: { score, secondsPlayed, displayName },
        })
      : await prisma.gameScore.create({
          data: {
            email,
            displayName,
            score,
            secondsPlayed,
            windowStartedAt: config.windowStartedAt,
          },
        });

    return NextResponse.json({ ok: true, id: saved.id, updated: !!existing });
  } catch (err) {
    console.error("[POST /api/admin/game/scores]", err);
    return NextResponse.json(
      { error: "Could not save score" },
      { status: 500 }
    );
  }
}
