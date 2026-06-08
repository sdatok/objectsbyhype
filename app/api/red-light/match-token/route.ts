import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signMatchToken } from "@/lib/survivor-hmac";
import {
  getOrCreateRedLightConfig,
  getCurrentRedLightMatch,
  RED_LIGHT_MAX_LOBBY_PARTICIPANTS,
} from "@/lib/red-light-config";
import { ensureRedLightGameServerMatchBound } from "@/lib/red-light-game-server-sync";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISPLAY_NAME_MAX = 24;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const email = String(body.email ?? "").trim().toLowerCase();
    const displayName = String(body.displayName ?? "").trim();

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
    }
    if (displayName.length < 2 || displayName.length > DISPLAY_NAME_MAX) {
      return NextResponse.json(
        { error: `Display name must be 2-${DISPLAY_NAME_MAX} characters.` },
        { status: 400 }
      );
    }

    const config = await getOrCreateRedLightConfig();
    if (!config.enabled) {
      return NextResponse.json({ error: "Red Light Green Light is currently disabled." }, { status: 403 });
    }
    const current = await getCurrentRedLightMatch(config);
    if (!current) {
      return NextResponse.json({ error: "No match open right now." }, { status: 409 });
    }
    if (current.status === "ENDED") {
      return NextResponse.json({ error: "This match has already ended." }, { status: 409 });
    }
    const spectate = body.spectate === true;
    if (current.status === "PLAYING" && !spectate) {
      return NextResponse.json(
        { error: "Match in progress — spectate live or wait for the next one." },
        { status: 409 }
      );
    }

    const existing = await prisma.redLightParticipant.findUnique({
      where: { matchId_email: { matchId: current.id, email } },
    });

    await ensureRedLightGameServerMatchBound(current, config);

    if (!spectate) {
      if (!existing) {
        const count = await prisma.redLightParticipant.count({
          where: { matchId: current.id },
        });
        if (count >= RED_LIGHT_MAX_LOBBY_PARTICIPANTS) {
          return NextResponse.json({ error: "Lobby is full." }, { status: 409 });
        }
        await prisma.redLightParticipant.create({
          data: { matchId: current.id, email, displayName },
        });
      } else if (existing.displayName !== displayName) {
        return NextResponse.json(
          { error: `You're already in as "${existing.displayName}".` },
          { status: 409 }
        );
      }
    } else if (existing && existing.displayName !== displayName) {
      return NextResponse.json(
        { error: `You're already registered as "${existing.displayName}".` },
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

    return NextResponse.json({
      matchId: current.id,
      email,
      displayName,
      matchToken,
      issuedAtMs,
      wsUrl: process.env.NEXT_PUBLIC_SURVIVOR_WS_URL ?? "",
      status: current.status,
    });
  } catch (err) {
    console.error("[POST /api/red-light/match-token]", err);
    return NextResponse.json({ error: "Could not join the lobby." }, { status: 500 });
  }
}
