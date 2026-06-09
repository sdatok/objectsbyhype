import { NextResponse } from "next/server";
import {
  ensureOpenRound,
  getOrCreateBlackjackConfig,
} from "@/lib/blackjack-config";
import { setBetAmount } from "@/lib/blackjack-table";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface BetBody {
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

    const body = (await request.json()) as BetBody;
    const email = (body.email ?? "").trim().toLowerCase();
    const bet = Number(body.bet);

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (!Number.isFinite(bet)) {
      return NextResponse.json({ error: "Invalid bet" }, { status: 400 });
    }

    await ensureOpenRound(config);
    const seat = await setBetAmount(email, Math.floor(bet));

    return NextResponse.json({
      currentBet: seat.currentBet,
      stackCredits: seat.stackCredits,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not set bet";
    console.error("[POST /api/blackjack/bet]", err);
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
