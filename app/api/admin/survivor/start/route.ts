import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { signAdminCommand } from "@/lib/survivor-hmac";
import {
  getOrCreateSurvivorConfig,
  SURVIVOR_CONFIG_ID,
  clampLobbySeconds,
  clampMatchSeconds,
} from "@/lib/survivor-config";

export const dynamic = "force-dynamic";

interface StartBody {
  /** Optional override for this match only. Defaults to config.matchSeconds. */
  matchSeconds?: number;
  /** Lobby duration before COUNTDOWN flips to PLAYING. */
  lobbySeconds?: number;
}

/**
 * Admin opens a new match. Creates the DB row, points SurvivorConfig at it,
 * then signs and POSTs an "admin start" command to the Colyseus server.
 *
 * If a previous match is still WAITING/PLAYING, this aborts to avoid the
 * confusing two-active-matches state. Admin must End the previous match
 * first (or wait for it to finish).
 */
export async function POST(request: Request) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as StartBody;
    const config = await getOrCreateSurvivorConfig();
    if (!config.enabled) {
      return NextResponse.json(
        { error: "Survivor is disabled in config." },
        { status: 400 }
      );
    }

    if (config.currentMatchId) {
      const current = await prisma.survivorMatch.findUnique({
        where: { id: config.currentMatchId },
      });
      if (current && current.status !== "ENDED") {
        return NextResponse.json(
          {
            error:
              "A previous match is still active. End it before starting a new one.",
          },
          { status: 409 }
        );
      }
    }

    const matchSeconds = clampMatchSeconds(
      body.matchSeconds,
      config.matchSeconds
    );
    const lobbySeconds = clampLobbySeconds(body.lobbySeconds, 60);

    const baseUrl = process.env.SURVIVOR_GAME_SERVER_URL;
    if (!baseUrl) {
      return NextResponse.json(
        { error: "SURVIVOR_GAME_SERVER_URL not configured." },
        { status: 500 }
      );
    }

    // Create the SurvivorMatch first to get an id, but DON'T point
    // currentMatchId at it until Railway has accepted the start. If we
    // flipped currentMatchId before the game server knew, players polling
    // /api/survivor/state could mint match-tokens for an id the room hasn't
    // been told about yet, and onAuth would reject them with
    // "Match has moved on".
    const match = await prisma.survivorMatch.create({
      data: {
        prizeTitle: config.prizeTitle,
        status: "WAITING",
      },
    });

    const issuedAtMs = Date.now();
    const signature = signAdminCommand({
      command: "start",
      matchId: match.id,
      issuedAtMs,
    });

    const upstream = await fetch(`${baseUrl.replace(/\/$/, "")}/admin/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Signature": signature,
        "X-Admin-Issued-At": String(issuedAtMs),
      },
      body: JSON.stringify({
        matchId: match.id,
        prizeTitle: config.prizeTitle,
        matchSeconds,
        lobbySeconds,
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      // Roll back: drop the placeholder match row so the matchId can't be
      // referenced later. currentMatchId was never set so nothing else to undo.
      await prisma.survivorMatch
        .delete({ where: { id: match.id } })
        .catch(() => undefined);
      return NextResponse.json(
        {
          error: `Game server rejected start: ${upstream.status} ${text.slice(0, 200)}`,
        },
        { status: 502 }
      );
    }

    // Railway has accepted and bound state.matchId — only NOW expose it to
    // lobby clients.
    await prisma.survivorConfig.update({
      where: { id: SURVIVOR_CONFIG_ID },
      data: { currentMatchId: match.id },
    });

    return NextResponse.json({
      ok: true,
      matchId: match.id,
      matchSeconds,
      lobbySeconds,
    });
  } catch (err) {
    console.error("[POST /api/admin/survivor/start]", err);
    return NextResponse.json(
      { error: "Could not start a match." },
      { status: 500 }
    );
  }
}
