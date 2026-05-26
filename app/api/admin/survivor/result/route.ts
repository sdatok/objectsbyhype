import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  verifyResultWebhook,
  sha256Hex,
} from "@/lib/survivor-hmac";
import { SURVIVOR_CONFIG_ID } from "@/lib/survivor-config";

export const dynamic = "force-dynamic";

interface ResultParticipantBody {
  email: string;
  displayName: string;
  placement: number;
  kills: number;
  survivedSeconds: number;
}

interface ResultBody {
  matchId: string;
  startedAt: string;
  endedAt: string;
  winnerEmail: string | null;
  participants: ResultParticipantBody[];
}

/**
 * Webhook called by the Colyseus game server when a match ends. The body is
 * HMAC-signed by the same SURVIVOR_SECRET used to sign admin commands. This
 * route:
 *   1. verifies the signature (no admin cookie here — it's a machine call)
 *   2. flips SurvivorMatch.status -> ENDED with timing + winner
 *   3. upserts placements/kills/survivedSeconds per participant
 *   4. clears SurvivorConfig.currentMatchId so a new match can be opened
 */
export async function POST(request: Request) {
  try {
    const matchIdHeader = request.headers.get("x-survivor-match-id") ?? "";
    const issuedAtHeader = Number(
      request.headers.get("x-survivor-issued-at") ?? ""
    );
    const signature = request.headers.get("x-survivor-signature") ?? "";

    if (!matchIdHeader || !Number.isFinite(issuedAtHeader) || !signature) {
      return NextResponse.json(
        { error: "Missing signature headers" },
        { status: 400 }
      );
    }

    // Read body as text so we can both parse and hash it.
    const raw = await request.text();
    const bodyHash = sha256Hex(raw);
    const ok = verifyResultWebhook(
      { matchId: matchIdHeader, issuedAtMs: issuedAtHeader },
      bodyHash,
      signature
    );
    if (!ok) {
      return NextResponse.json({ error: "Bad signature" }, { status: 401 });
    }

    let body: ResultBody;
    try {
      body = JSON.parse(raw) as ResultBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (body.matchId !== matchIdHeader) {
      return NextResponse.json(
        { error: "matchId header/body mismatch" },
        { status: 400 }
      );
    }

    const match = await prisma.survivorMatch.findUnique({
      where: { id: body.matchId },
    });
    if (!match) {
      return NextResponse.json({ error: "Unknown match" }, { status: 404 });
    }
    if (match.status === "ENDED") {
      // Idempotent: dup webhook should not blow up.
      return NextResponse.json({ ok: true, note: "already-ended" });
    }

    const startedAt = new Date(body.startedAt);
    const endedAt = new Date(body.endedAt);

    await prisma.$transaction(async (tx) => {
      await tx.survivorMatch.update({
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
        // Upsert: the Next.js lobby created most participant rows already,
        // but the game server is the source of truth on placement/kills.
        await tx.survivorParticipant.upsert({
          where: {
            matchId_email: { matchId: body.matchId, email },
          },
          create: {
            matchId: body.matchId,
            email,
            displayName: String(p.displayName).slice(0, 32),
            placement: Math.max(0, Math.floor(p.placement)) || null,
            kills: Math.max(0, Math.floor(p.kills)),
            survivedSeconds: Math.max(0, Math.floor(p.survivedSeconds)),
          },
          update: {
            placement: Math.max(0, Math.floor(p.placement)) || null,
            kills: Math.max(0, Math.floor(p.kills)),
            survivedSeconds: Math.max(0, Math.floor(p.survivedSeconds)),
            disconnectedAt: new Date(),
          },
        });
      }

      await tx.survivorConfig.update({
        where: { id: SURVIVOR_CONFIG_ID },
        data: { currentMatchId: null },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/admin/survivor/result]", err);
    return NextResponse.json(
      { error: "Could not store result." },
      { status: 500 }
    );
  }
}
