import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { signAdminCommand } from "@/lib/survivor-hmac";
import {
  getOrCreateSurvivorConfig,
  SURVIVOR_CONFIG_ID,
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

    const matchSeconds = Math.max(
      30,
      Math.min(3600, Number(body.matchSeconds) || config.matchSeconds)
    );
    const lobbySeconds = Math.max(
      5,
      Math.min(600, Number(body.lobbySeconds) || 60)
    );

    const match = await prisma.survivorMatch.create({
      data: {
        prizeTitle: config.prizeTitle,
        status: "WAITING",
      },
    });
    await prisma.survivorConfig.update({
      where: { id: SURVIVOR_CONFIG_ID },
      data: { currentMatchId: match.id },
    });

    const baseUrl = process.env.SURVIVOR_GAME_SERVER_URL;
    if (!baseUrl) {
      return NextResponse.json(
        { error: "SURVIVOR_GAME_SERVER_URL not configured." },
        { status: 500 }
      );
    }

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
      // Roll back: don't leave currentMatchId pointing at a row the game
      // server never accepted.
      await prisma.survivorMatch.delete({ where: { id: match.id } }).catch(() => undefined);
      await prisma.survivorConfig
        .update({
          where: { id: SURVIVOR_CONFIG_ID },
          data: { currentMatchId: null },
        })
        .catch(() => undefined);
      return NextResponse.json(
        {
          error: `Game server rejected start: ${upstream.status} ${text.slice(0, 200)}`,
        },
        { status: 502 }
      );
    }

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
