import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signMatchToken } from "@/lib/survivor-hmac";
import {
  getOrCreateSurvivorConfig,
  getCurrentMatch,
  SURVIVOR_MAX_LOBBY_PARTICIPANTS,
} from "@/lib/survivor-config";
import { ensureGameServerMatchBound } from "@/lib/survivor-game-server-sync";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISPLAY_NAME_MAX = 24;

/** Best-effort IP for rate-limiting. */
function getRequestIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

/**
 * Lobby join. The player submits their displayName + email; this endpoint:
 *   1. validates the inputs and the lobby state
 *   2. records or reuses a SurvivorParticipant row for this match
 *   3. issues a short-lived HMAC matchToken the player uses to connect to
 *      the Colyseus room
 *
 * The Colyseus server re-verifies the token + match status on its own; this
 * route just makes sure tokens map back to a real lobby entry so we can
 * audit / dedupe.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const email = String(body.email ?? "").trim().toLowerCase();
    const displayName = String(body.displayName ?? "").trim();

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email so we can contact you if you win." },
        { status: 400 }
      );
    }
    if (displayName.length < 2 || displayName.length > DISPLAY_NAME_MAX) {
      return NextResponse.json(
        { error: `Display name must be 2-${DISPLAY_NAME_MAX} characters.` },
        { status: 400 }
      );
    }
    if (!/^[\w\-. ]+$/.test(displayName)) {
      return NextResponse.json(
        { error: "Display name can only contain letters, numbers, spaces, _ - and ." },
        { status: 400 }
      );
    }

    // Best-effort source for logs; the Colyseus server enforces per-email
    // dedupe and the active fighter cap.
    void getRequestIp(request);

    const config = await getOrCreateSurvivorConfig();
    if (!config.enabled) {
      return NextResponse.json(
        { error: "Survivor is currently disabled." },
        { status: 403 }
      );
    }
    const current = await getCurrentMatch(config);
    if (!current) {
      return NextResponse.json(
        { error: "No match open right now. Check back when one starts." },
        { status: 409 }
      );
    }
    if (current.status === "ENDED") {
      return NextResponse.json(
        { error: "The current match has already ended." },
        { status: 409 }
      );
    }

    const existing = await prisma.survivorParticipant.findUnique({
      where: {
        matchId_email: { matchId: current.id, email },
      },
    });

    if (current.status === "PLAYING") {
      return NextResponse.json(
        {
          error:
            "Match in progress — if you disconnected, wait for reconnect or the next match.",
        },
        { status: 409 }
      );
    }

    await ensureGameServerMatchBound(current, config);

    if (!existing) {
      // Cap DB rows before the game server rejects the 50-fighter limit.
      const count = await prisma.survivorParticipant.count({
        where: { matchId: current.id },
      });
      if (count >= SURVIVOR_MAX_LOBBY_PARTICIPANTS) {
        return NextResponse.json(
          { error: "Lobby is full." },
          { status: 409 }
        );
      }
      await prisma.survivorParticipant.create({
        data: { matchId: current.id, email, displayName },
      });
    } else if (existing.displayName !== displayName) {
      // Lock display name to first submission for clean audit / leaderboard.
      return NextResponse.json(
        {
          error: `You're already in this match as "${existing.displayName}".`,
        },
        { status: 409 }
      );
    }

    const issuedAtMs = Date.now();
    const matchToken = signMatchToken({
      matchId: current.id,
      email,
      displayName,
      issuedAtMs,
    });

    const wsUrl = process.env.NEXT_PUBLIC_SURVIVOR_WS_URL ?? "";

    return NextResponse.json({
      matchId: current.id,
      email,
      displayName,
      matchToken,
      issuedAtMs,
      wsUrl,
      status: current.status,
    });
  } catch (err) {
    console.error("[POST /api/survivor/match-token]", err);
    return NextResponse.json(
      { error: "Could not join the lobby." },
      { status: 500 }
    );
  }
}
