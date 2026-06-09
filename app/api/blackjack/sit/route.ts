import { NextResponse } from "next/server";
import {
  ensureOpenRound,
  getOrCreateBlackjackConfig,
} from "@/lib/blackjack-config";
import { sitAtTable } from "@/lib/blackjack-table";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SitBody {
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

    const body = (await request.json()) as SitBody;
    const email = (body.email ?? "").trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email." },
        { status: 400 }
      );
    }

    const displayNameRaw = (body.displayName ?? "").trim();
    const displayName = displayNameRaw
      ? displayNameRaw.slice(0, 32)
      : email.split("@")[0] ?? "Player";

    await ensureOpenRound(config);
    const seat = await sitAtTable({ email, displayName });

    return NextResponse.json({
      seatIndex: seat.seatIndex,
      stackCredits: seat.stackCredits,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not take a seat";
    console.error("[POST /api/blackjack/sit]", err);
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
