import { NextResponse } from "next/server";
import {
  listBlackjackChatMessages,
  postBlackjackChatMessage,
} from "@/lib/blackjack-chat";
import { ensureOpenRound, getOrCreateBlackjackConfig } from "@/lib/blackjack-config";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const roundId = url.searchParams.get("roundId")?.trim();
    const afterRaw = url.searchParams.get("after");
    const email = url.searchParams.get("email")?.trim().toLowerCase() || null;
    const afterMs = afterRaw ? parseInt(afterRaw, 10) : null;

    if (!roundId) {
      return NextResponse.json({ error: "Missing roundId" }, { status: 400 });
    }

    const messages = await listBlackjackChatMessages(roundId, afterMs, email);
    return NextResponse.json({ messages });
  } catch (err) {
    console.error("[GET /api/blackjack/chat]", err);
    return NextResponse.json(
      { error: "Could not load chat" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const config = await getOrCreateBlackjackConfig();
    if (!config.enabled) {
      return NextResponse.json({ error: "Chat is offline." }, { status: 403 });
    }

    const body = (await request.json()) as {
      roundId?: string;
      email?: string;
      displayName?: string;
      message?: string;
    };

    const roundId = (body.roundId ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const displayName = (body.displayName ?? "").trim().slice(0, 32);
    const message = body.message ?? "";

    if (!roundId) {
      return NextResponse.json({ error: "Missing round" }, { status: 400 });
    }
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
    if (displayName.length < 1) {
      return NextResponse.json({ error: "Display name required" }, { status: 400 });
    }

    const { round } = await ensureOpenRound(config);
    if (round.id !== roundId || round.status !== "OPEN") {
      return NextResponse.json(
        { error: "This round has ended." },
        { status: 409 }
      );
    }

    const row = await postBlackjackChatMessage({
      roundId,
      email,
      displayName,
      body: message,
    });

    return NextResponse.json({ message: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not send message";
    console.error("[POST /api/blackjack/chat]", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
