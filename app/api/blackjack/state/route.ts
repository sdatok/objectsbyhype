import { NextResponse } from "next/server";
import { buildPublicBlackjackState } from "@/lib/blackjack-config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get("email")?.trim().toLowerCase() || null;
    const state = await buildPublicBlackjackState(email);
    return NextResponse.json(state);
  } catch (err) {
    console.error("[GET /api/blackjack/state]", err);
    return NextResponse.json(
      { error: "Could not load blackjack state" },
      { status: 500 }
    );
  }
}
