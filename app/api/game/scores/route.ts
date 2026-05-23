import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateGameConfig, rollWindowIfExpired } from "@/lib/game-config";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SCORE = 1_000_000; // sanity cap to keep cheaters out of the leaderboard
const MAX_SECONDS = 60 * 60; // one hour is a generous upper bound for a single game

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      displayName?: string;
      score?: number;
      secondsPlayed?: number;
    };

    const email = (body.email ?? "").trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email so we can contact you if you win." },
        { status: 400 }
      );
    }

    const score = Math.floor(Number(body.score));
    if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) {
      return NextResponse.json({ error: "Invalid score" }, { status: 400 });
    }

    const secondsPlayed = Math.max(
      0,
      Math.min(MAX_SECONDS, Math.floor(Number(body.secondsPlayed ?? 0)))
    );

    const displayNameRaw = (body.displayName ?? "").trim();
    const displayName = displayNameRaw
      ? displayNameRaw.slice(0, 32)
      : null;

    const config = await rollWindowIfExpired(await getOrCreateGameConfig());
    if (!config.enabled) {
      return NextResponse.json(
        { error: "The game is currently disabled." },
        { status: 403 }
      );
    }

    const saved = await prisma.gameScore.create({
      data: {
        email,
        displayName,
        score,
        secondsPlayed,
        windowStartedAt: config.windowStartedAt,
      },
    });

    return NextResponse.json({ ok: true, id: saved.id });
  } catch (err) {
    console.error("[POST /api/game/scores]", err);
    return NextResponse.json(
      { error: "Could not save your score" },
      { status: 500 }
    );
  }
}
