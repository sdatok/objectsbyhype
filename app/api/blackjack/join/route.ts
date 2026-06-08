import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  ensureOpenRound,
  getOrCreateBlackjackConfig,
} from "@/lib/blackjack-config";
import { cardsToJson, startSession } from "@/lib/blackjack-engine";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface JoinBody {
  email?: string;
  displayName?: string;
}

export async function POST(request: Request) {
  try {
    const config = await getOrCreateBlackjackConfig();
    if (!config.enabled) {
      return NextResponse.json(
        { error: "Blackjack is currently offline." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as JoinBody;
    const email = (body.email ?? "").trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email so we can send your wheel code if you win." },
        { status: 400 }
      );
    }

    const displayNameRaw = (body.displayName ?? "").trim();
    const displayName = displayNameRaw
      ? displayNameRaw.slice(0, 32)
      : email.split("@")[0] ?? "Player";

    const { round } = await ensureOpenRound(config);
    if (Date.now() >= round.endsAt.getTime()) {
      return NextResponse.json(
        { error: "This round just ended — refresh for the next hand." },
        { status: 409 }
      );
    }

    const existing = await prisma.blackjackEntry.findUnique({
      where: { roundId_email: { roundId: round.id, email } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "You already played this round. One hand every 3 minutes." },
        { status: 409 }
      );
    }

    const session = startSession();
    const finished = session.state.outcome != null;

    const entry = await prisma.blackjackEntry.create({
      data: {
        roundId: round.id,
        email,
        displayName,
        playerCards: cardsToJson(session.state.playerCards),
        dealerCards: cardsToJson(session.state.dealerCards),
        deckRemaining: finished
          ? Prisma.DbNull
          : cardsToJson(session.deckRemaining),
        outcome: session.state.outcome,
        handValue: session.state.handValue,
        finishedAt: finished ? new Date() : null,
      },
    });

    return NextResponse.json({ entryId: entry.id, finished });
  } catch (err) {
    console.error("[POST /api/blackjack/join]", err);
    return NextResponse.json(
      { error: "Could not start your hand" },
      { status: 500 }
    );
  }
}
