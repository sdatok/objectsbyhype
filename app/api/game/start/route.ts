import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signGameSession } from "@/lib/game-hmac";
import { getOrCreateGameConfig, rollWindowIfExpired } from "@/lib/game-config";

export const dynamic = "force-dynamic";

/** Best-effort source IP for abuse triage. */
function getRequestIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

/**
 * Issues an anti-cheat session token. The client must call this when a
 * round starts and send `{ sessionId, signature }` back to /api/game/scores
 * on submit. Without a valid, single-use session the score submit is rejected.
 */
export async function POST(request: Request) {
  try {
    const config = await rollWindowIfExpired(await getOrCreateGameConfig());
    if (!config.enabled) {
      return NextResponse.json(
        { error: "The game is currently disabled." },
        { status: 403 }
      );
    }

    const ip = getRequestIp(request);
    const session = await prisma.gameSession.create({
      data: {
        signature: "", // filled in below; created so we have a real id first
        ip,
      },
    });
    const signature = signGameSession(session.id, session.issuedAt.getTime());
    await prisma.gameSession.update({
      where: { id: session.id },
      data: { signature },
    });

    return NextResponse.json({
      sessionId: session.id,
      signature,
      issuedAt: session.issuedAt.toISOString(),
    });
  } catch (err) {
    console.error("[POST /api/game/start]", err);
    return NextResponse.json(
      { error: "Could not start a session" },
      { status: 500 }
    );
  }
}
