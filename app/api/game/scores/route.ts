import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateGameConfig, rollWindowIfExpired } from "@/lib/game-config";
import { verifyGameSession } from "@/lib/game-hmac";
import {
  validateScorePlausibility,
  validateTapStats,
  type TapStatsPayload,
} from "@/lib/game-anticheat";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MIN_SECONDS = 3;
const MAX_SECONDS = 60 * 60;
const SESSION_SUBMIT_BUFFER_MS = 10 * 60 * 1000;
const SESSION_MAX_AGE_MS = MAX_SECONDS * 1000 + SESSION_SUBMIT_BUFFER_MS;
const WALL_CLOCK_TOLERANCE_MS = 10_000;

interface SubmitBody {
  email?: string;
  displayName?: string;
  score?: number;
  secondsPlayed?: number;
  sessionId?: string;
  signature?: string;
  tapStats?: TapStatsPayload;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SubmitBody;

    const email = (body.email ?? "").trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email so we can contact you if you win." },
        { status: 400 }
      );
    }

    const score = Math.floor(Number(body.score));
    if (!Number.isFinite(score) || score < 0) {
      return NextResponse.json({ error: "Invalid score" }, { status: 400 });
    }

    const secondsPlayed = Math.floor(Number(body.secondsPlayed ?? 0));
    if (
      !Number.isFinite(secondsPlayed) ||
      secondsPlayed < MIN_SECONDS ||
      secondsPlayed > MAX_SECONDS
    ) {
      return NextResponse.json({ error: "Invalid round" }, { status: 400 });
    }

    const displayNameRaw = (body.displayName ?? "").trim();
    const displayName = displayNameRaw ? displayNameRaw.slice(0, 32) : null;

    const sessionId = (body.sessionId ?? "").trim();
    const signature = (body.signature ?? "").trim();
    if (!sessionId || !signature) {
      return NextResponse.json(
        { error: "Missing game session — refresh and play again." },
        { status: 400 }
      );
    }

    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      return NextResponse.json(
        { error: "Unknown game session — refresh and play again." },
        { status: 400 }
      );
    }
    if (session.usedAt) {
      return NextResponse.json(
        { error: "This session was already submitted." },
        { status: 409 }
      );
    }
    if (
      !verifyGameSession(session.id, session.issuedAt.getTime(), signature)
    ) {
      return NextResponse.json(
        { error: "Session signature mismatch." },
        { status: 400 }
      );
    }
    const sessionAgeMs = Date.now() - session.issuedAt.getTime();
    if (sessionAgeMs > SESSION_MAX_AGE_MS) {
      return NextResponse.json(
        { error: "Session expired — start a new round." },
        { status: 400 }
      );
    }
    if (sessionAgeMs < secondsPlayed * 1000 - WALL_CLOCK_TOLERANCE_MS) {
      return NextResponse.json(
        { error: "Round timing is implausible." },
        { status: 400 }
      );
    }

    const config = await rollWindowIfExpired(await getOrCreateGameConfig());
    if (!config.enabled) {
      return NextResponse.json(
        { error: "The game is currently disabled." },
        { status: 403 }
      );
    }

    const plausibilityError = validateScorePlausibility(
      score,
      secondsPlayed,
      config.gameSpeed
    );
    if (plausibilityError) {
      return NextResponse.json({ error: plausibilityError }, { status: 400 });
    }

    const tapError = validateTapStats(
      score,
      secondsPlayed,
      body.tapStats ?? {}
    );
    if (tapError) {
      return NextResponse.json({ error: tapError }, { status: 400 });
    }

    const existing = await prisma.gameScore.findFirst({
      where: { email, windowStartedAt: config.windowStartedAt },
      orderBy: { score: "desc" },
    });
    if (existing && existing.score >= score) {
      return NextResponse.json(
        {
          error: `You already submitted ${existing.score.toLocaleString()} this window — beat that to update.`,
        },
        { status: 409 }
      );
    }

    const claim = await prisma.gameSession.updateMany({
      where: { id: session.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claim.count === 0) {
      return NextResponse.json(
        { error: "This session was already submitted." },
        { status: 409 }
      );
    }

    if (existing) {
      await prisma.gameScore.delete({ where: { id: existing.id } });
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
