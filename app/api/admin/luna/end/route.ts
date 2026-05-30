import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { signAdminCommand } from "@/lib/survivor-hmac";
import { getOrCreateLunaConfig, LUNA_CONFIG_ID } from "@/lib/luna-config";

export const dynamic = "force-dynamic";

export async function POST() {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = await getOrCreateLunaConfig();
    if (!config.currentMatchId) {
      return NextResponse.json({ error: "No active match." }, { status: 409 });
    }
    const match = await prisma.escapeLunaMatch.findUnique({
      where: { id: config.currentMatchId },
    });
    if (!match || match.status === "ENDED") {
      return NextResponse.json({ error: "Match already ended." }, { status: 409 });
    }

    const baseUrl = process.env.SURVIVOR_GAME_SERVER_URL;
    if (!baseUrl) {
      return NextResponse.json({ error: "SURVIVOR_GAME_SERVER_URL not configured." }, { status: 500 });
    }

    const issuedAtMs = Date.now();
    const signature = signAdminCommand({ command: "end", matchId: match.id, issuedAtMs });
    const upstream = await fetch(`${baseUrl.replace(/\/$/, "")}/admin/luna/end`, {
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
        { error: `Game server rejected end: ${upstream.status} ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.escapeLunaMatch.update({
        where: { id: match.id },
        data: { status: "ENDED", endedAt: match.endedAt ?? new Date() },
      });
      await tx.escapeLunaConfig.update({
        where: { id: LUNA_CONFIG_ID },
        data: { currentMatchId: null },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/admin/luna/end]", err);
    return NextResponse.json({ error: "Could not end match." }, { status: 500 });
  }
}
