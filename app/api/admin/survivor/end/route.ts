import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { signAdminCommand } from "@/lib/survivor-hmac";
import {
  getOrCreateSurvivorConfig,
  SURVIVOR_CONFIG_ID,
} from "@/lib/survivor-config";

export const dynamic = "force-dynamic";

/**
 * Force-end the current match. The Colyseus server will still POST a result
 * webhook for whatever state the match was in; this route only signals it
 * to stop the simulation early.
 */
export async function POST() {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = await getOrCreateSurvivorConfig();
    if (!config.currentMatchId) {
      return NextResponse.json(
        { error: "No active match." },
        { status: 409 }
      );
    }
    const match = await prisma.survivorMatch.findUnique({
      where: { id: config.currentMatchId },
    });
    if (!match || match.status === "ENDED") {
      return NextResponse.json(
        { error: "Match already ended." },
        { status: 409 }
      );
    }

    const baseUrl = process.env.SURVIVOR_GAME_SERVER_URL;
    if (!baseUrl) {
      return NextResponse.json(
        { error: "SURVIVOR_GAME_SERVER_URL not configured." },
        { status: 500 }
      );
    }

    const issuedAtMs = Date.now();
    const signature = signAdminCommand({
      command: "end",
      matchId: match.id,
      issuedAtMs,
    });
    const upstream = await fetch(`${baseUrl.replace(/\/$/, "")}/admin/end`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Signature": signature,
        "X-Admin-Issued-At": String(issuedAtMs),
      },
      body: JSON.stringify({ matchId: match.id }),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return NextResponse.json(
        {
          error: `Game server rejected end: ${upstream.status} ${text.slice(0, 200)}`,
        },
        { status: 502 }
      );
    }

    // Self-heal the DB. The game server normally posts a result webhook on
    // match end, which would do this for us — but if the room had lost its
    // state (e.g. after a Railway restart) /admin/end is a no-op there and
    // no webhook will fire. Clearing here unblocks the admin "Open new match"
    // path unconditionally. If a webhook does arrive afterwards, the result
    // handler is idempotent against an already-ENDED match.
    await prisma.$transaction(async (tx) => {
      await tx.survivorMatch.update({
        where: { id: match.id },
        data: {
          status: "ENDED",
          endedAt: match.endedAt ?? new Date(),
        },
      });
      await tx.survivorConfig.update({
        where: { id: SURVIVOR_CONFIG_ID },
        data: { currentMatchId: null },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/admin/survivor/end]", err);
    return NextResponse.json(
      { error: "Could not end match." },
      { status: 500 }
    );
  }
}
