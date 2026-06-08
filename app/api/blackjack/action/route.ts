import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ensureOpenRound, getOrCreateBlackjackConfig } from "@/lib/blackjack-config";
import {
  cardsToJson,
  hitSession,
  sessionFromEntry,
  standSession,
} from "@/lib/blackjack-engine";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ActionBody {
  email?: string;
  entryId?: string;
  action?: "hit" | "stand";
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

    const body = (await request.json()) as ActionBody;
    const email = (body.email ?? "").trim().toLowerCase();
    const entryId = (body.entryId ?? "").trim();
    const action = body.action;

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (!entryId) {
      return NextResponse.json({ error: "Missing entry" }, { status: 400 });
    }
    if (action !== "hit" && action !== "stand") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const entry = await prisma.blackjackEntry.findUnique({
      where: { id: entryId },
      include: { round: true },
    });
    if (!entry || entry.email !== email) {
      return NextResponse.json({ error: "Hand not found" }, { status: 404 });
    }
    if (entry.outcome) {
      return NextResponse.json({ error: "Hand already finished" }, { status: 409 });
    }

    await ensureOpenRound(config);
    if (entry.round.status !== "OPEN" || Date.now() >= entry.round.endsAt.getTime()) {
      return NextResponse.json(
        { error: "Round ended — your hand will be settled shortly." },
        { status: 409 }
      );
    }

    const session =
      action === "hit"
        ? hitSession(sessionFromEntry(entry))
        : standSession(sessionFromEntry(entry));
    const resolved = session.state;
    const finished = resolved.outcome != null;

    await prisma.blackjackEntry.update({
      where: { id: entry.id },
      data: {
        playerCards: cardsToJson(resolved.playerCards),
        dealerCards: cardsToJson(resolved.dealerCards),
        deckRemaining: finished
          ? Prisma.DbNull
          : cardsToJson(session.deckRemaining),
        outcome: resolved.outcome,
        handValue: resolved.handValue,
        finishedAt: finished ? new Date() : null,
      },
    });

    return NextResponse.json({ finished, outcome: resolved.outcome });
  } catch (err) {
    console.error("[POST /api/blackjack/action]", err);
    return NextResponse.json(
      { error: "Could not update your hand" },
      { status: 500 }
    );
  }
}
