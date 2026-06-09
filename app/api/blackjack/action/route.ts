import { NextResponse } from "next/server";
import {
  ensureOpenRound,
  getOrCreateBlackjackConfig,
} from "@/lib/blackjack-config";
import { performHandAction } from "@/lib/blackjack-table";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ActionBody {
  email?: string;
  action?: "hit" | "stand" | "double" | "split";
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
    const action = body.action;

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (
      action !== "hit" &&
      action !== "stand" &&
      action !== "double" &&
      action !== "split"
    ) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    await ensureOpenRound(config);
    const seat = await performHandAction(email, action);

    return NextResponse.json({
      handPhase: seat.handPhase,
      stackCredits: seat.stackCredits,
      finished: seat.handPhase === "SETTLED",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not update hand";
    console.error("[POST /api/blackjack/action]", err);
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
