import { NextResponse } from "next/server";
import {
  ensureOpenRound,
  getOrCreateBlackjackConfig,
} from "@/lib/blackjack-config";
import { startDeal } from "@/lib/blackjack-table";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface DealBody {
  email?: string;
  bet?: number;
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

    const body = (await request.json()) as DealBody;
    const email = (body.email ?? "").trim().toLowerCase();
    const bet =
      body.bet != null && Number.isFinite(body.bet)
        ? Math.floor(body.bet)
        : undefined;

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const { round } = await ensureOpenRound(config);
    if (Date.now() >= round.endsAt.getTime()) {
      return NextResponse.json(
        { error: "Round just ended — refresh for the next round." },
        { status: 409 }
      );
    }

    const seat = await startDeal(email, bet);

    return NextResponse.json({
      handPhase: seat.handPhase,
      stackCredits: seat.stackCredits,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not deal";
    console.error("[POST /api/blackjack/deal]", err);
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
