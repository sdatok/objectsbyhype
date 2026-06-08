import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { signAdminCommand } from "@/lib/survivor-hmac";
import {
  getOrCreateRedLightConfig,
  RED_LIGHT_CONFIG_ID,
  clampLobbySeconds,
  clampMatchSeconds,
} from "@/lib/red-light-config";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      matchSeconds?: number;
      lobbySeconds?: number;
    };
    const config = await getOrCreateRedLightConfig();
    if (!config.enabled) {
      return NextResponse.json({ error: "Red Light Green Light is disabled." }, { status: 400 });
    }

    if (config.currentMatchId) {
      const current = await prisma.redLightMatch.findUnique({
        where: { id: config.currentMatchId },
      });
      if (current && current.status !== "ENDED") {
        return NextResponse.json(
          { error: "End the current match before starting a new one." },
          { status: 409 }
        );
      }
    }

    const matchSeconds = clampMatchSeconds(body.matchSeconds, config.matchSeconds);
    const lobbySeconds = clampLobbySeconds(body.lobbySeconds, 60);
    const baseUrl = process.env.SURVIVOR_GAME_SERVER_URL;
    if (!baseUrl) {
      return NextResponse.json({ error: "SURVIVOR_GAME_SERVER_URL not configured." }, { status: 500 });
    }

    const match = await prisma.redLightMatch.create({
      data: { prizeTitle: config.prizeTitle, status: "WAITING" },
    });

    const issuedAtMs = Date.now();
    const signature = signAdminCommand({ command: "start", matchId: match.id, issuedAtMs });

    const upstream = await fetch(`${baseUrl.replace(/\/$/, "")}/admin/red-light/start`, {
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
      await prisma.redLightMatch.delete({ where: { id: match.id } }).catch(() => undefined);
      const text = await upstream.text().catch(() => "");
      return NextResponse.json(
        { error: `Game server rejected start: ${upstream.status} ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    await prisma.redLightConfig.update({
      where: { id: RED_LIGHT_CONFIG_ID },
      data: { currentMatchId: match.id },
    });

    return NextResponse.json({ ok: true, matchId: match.id, matchSeconds, lobbySeconds });
  } catch (err) {
    console.error("[POST /api/admin/red-light/start]", err);
    return NextResponse.json({ error: "Could not start match." }, { status: 500 });
  }
}
