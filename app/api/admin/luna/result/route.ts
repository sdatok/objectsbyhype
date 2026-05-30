import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyResultWebhook, sha256Hex } from "@/lib/survivor-hmac";
import { LUNA_CONFIG_ID } from "@/lib/luna-config";

export const dynamic = "force-dynamic";

interface ResultBody {
  matchId: string;
  startedAt: string;
  endedAt: string;
  winnerEmail: string | null;
  participants: Array<{
    email: string;
    displayName: string;
    placement: number;
    kills: number;
    survivedSeconds: number;
  }>;
}

export async function POST(request: Request) {
  try {
    const matchIdHeader = request.headers.get("x-survivor-match-id") ?? "";
    const issuedAtHeader = Number(request.headers.get("x-survivor-issued-at") ?? "");
    const signature = request.headers.get("x-survivor-signature") ?? "";

    if (!matchIdHeader || !Number.isFinite(issuedAtHeader) || !signature) {
      return NextResponse.json({ error: "Missing signature headers" }, { status: 400 });
    }

    const raw = await request.text();
    const ok = verifyResultWebhook(
      { matchId: matchIdHeader, issuedAtMs: issuedAtHeader },
      sha256Hex(raw),
      signature
    );
    if (!ok) {
      return NextResponse.json({ error: "Bad signature" }, { status: 401 });
    }

    const body = JSON.parse(raw) as ResultBody;
    if (body.matchId !== matchIdHeader) {
      return NextResponse.json({ error: "matchId mismatch" }, { status: 400 });
    }

    const match = await prisma.escapeLunaMatch.findUnique({
      where: { id: body.matchId },
    });
    if (!match) {
      return NextResponse.json({ error: "Unknown match" }, { status: 404 });
    }
    if (match.status === "ENDED") {
      return NextResponse.json({ ok: true, note: "already-ended" });
    }

    const startedAt = new Date(body.startedAt);
    const endedAt = new Date(body.endedAt);

    await prisma.$transaction(async (tx) => {
      await tx.escapeLunaMatch.update({
        where: { id: body.matchId },
        data: {
          status: "ENDED",
          startedAt: Number.isNaN(startedAt.getTime()) ? null : startedAt,
          endedAt: Number.isNaN(endedAt.getTime()) ? new Date() : endedAt,
          winnerEmail: body.winnerEmail,
        },
      });

      for (const p of body.participants) {
        const email = String(p.email).toLowerCase();
        await tx.escapeLunaParticipant.upsert({
          where: { matchId_email: { matchId: body.matchId, email } },
          create: {
            matchId: body.matchId,
            email,
            displayName: String(p.displayName).slice(0, 32),
            placement: Math.max(0, Math.floor(p.placement)) || null,
            survivedSeconds: Math.max(0, Math.floor(p.survivedSeconds)),
          },
          update: {
            placement: Math.max(0, Math.floor(p.placement)) || null,
            survivedSeconds: Math.max(0, Math.floor(p.survivedSeconds)),
            disconnectedAt: new Date(),
          },
        });
      }

      await tx.escapeLunaConfig.update({
        where: { id: LUNA_CONFIG_ID },
        data: { currentMatchId: null },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/admin/luna/result]", err);
    return NextResponse.json({ error: "Could not store result." }, { status: 500 });
  }
}
