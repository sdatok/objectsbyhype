import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateGameConfig, rollWindowIfExpired } from "@/lib/game-config";
import { verifyGameSession } from "@/lib/game-hmac";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------- anti-cheat tunables ---------- */

/** Hard ceiling — way above any legit score. */
const MAX_SCORE = 50_000;
/** Generous server-side rate ceiling. Real top is ~30 pts/sec. */
const MAX_POINTS_PER_SECOND = 50;
/** Constant headroom so very short rounds aren't punished. */
const SCORE_HEADROOM = 100;
/** A round must take at least this long. */
const MIN_SECONDS = 3;
const MAX_SECONDS = 60 * 60;
/** A session must be consumed within 15 min of being issued. */
const SESSION_MAX_AGE_MS = 15 * 60 * 1000;
/** Wall-clock elapsed time must be within ±10s of secondsPlayed. */
const WALL_CLOCK_TOLERANCE_MS = 10_000;
/** Max wrong-tap ratio. Bots spamming 1,2,3 land ~33% but we allow slack. */
const MAX_WRONG_TAP_RATIO = 0.7;
/** No two taps closer than this. */
const MIN_INTER_TAP_MS = 60;
/** Inter-tap interval coefficient of variation floor — bots are too regular. */
const MIN_INTERVAL_CV = 0.08;
/** A round needs at least this many real taps to be considered. */
const MIN_TAPS_FOR_TIMING_CHECK = 6;

interface SubmitBody {
  email?: string;
  displayName?: string;
  score?: number;
  secondsPlayed?: number;
  sessionId?: string;
  signature?: string;
  /** Aggregate stats, computed on the client across the whole round. */
  tapStats?: {
    total?: number;
    wrong?: number;
    /** Smallest gap between two taps (ms). */
    minIntervalMs?: number;
    /** Coefficient of variation = stddev / mean of inter-tap intervals. */
    intervalCV?: number;
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SubmitBody;

    /* ---------- field-level validation ---------- */

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

    /* ---------- session HMAC ---------- */

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
    if (sessionAgeMs < (secondsPlayed * 1000) - WALL_CLOCK_TOLERANCE_MS) {
      // Client claims more elapsed time than the session has been alive.
      return NextResponse.json(
        { error: "Round timing is implausible." },
        { status: 400 }
      );
    }

    /* ---------- score plausibility ---------- */

    const ceiling = secondsPlayed * MAX_POINTS_PER_SECOND + SCORE_HEADROOM;
    if (score > ceiling) {
      return NextResponse.json(
        { error: "Score exceeds plausible cap." },
        { status: 400 }
      );
    }

    /* ---------- tap-stat checks (defeat 1,2,3 spam) ---------- */

    const stats = body.tapStats ?? {};
    const totalTaps = Math.floor(Number(stats.total ?? 0));
    const wrongTaps = Math.floor(Number(stats.wrong ?? 0));
    const minIntervalMs = Number(stats.minIntervalMs ?? Infinity);
    const intervalCV = Number(stats.intervalCV ?? 1);

    if (totalTaps >= MIN_TAPS_FOR_TIMING_CHECK) {
      if (wrongTaps / Math.max(1, totalTaps) > MAX_WRONG_TAP_RATIO) {
        return NextResponse.json(
          { error: "Too many wrong taps — looks automated." },
          { status: 400 }
        );
      }
      if (Number.isFinite(minIntervalMs) && minIntervalMs < MIN_INTER_TAP_MS) {
        return NextResponse.json(
          { error: "Tap rate is faster than humanly possible." },
          { status: 400 }
        );
      }
      if (Number.isFinite(intervalCV) && intervalCV < MIN_INTERVAL_CV) {
        return NextResponse.json(
          { error: "Tap timing is too uniform." },
          { status: 400 }
        );
      }
    }

    /* ---------- write ---------- */

    const config = await rollWindowIfExpired(await getOrCreateGameConfig());
    if (!config.enabled) {
      return NextResponse.json(
        { error: "The game is currently disabled." },
        { status: 403 }
      );
    }

    // Mark the session used FIRST so a parallel submit can't double-fire.
    // We check `where: { usedAt: null }` so this is atomic per session.
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
