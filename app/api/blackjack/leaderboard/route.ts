import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/blackjack-economy";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const leaderboard = await getLeaderboard(10);
    return NextResponse.json({ leaderboard });
  } catch (err) {
    console.error("[GET /api/blackjack/leaderboard]", err);
    return NextResponse.json(
      { error: "Could not load leaderboard" },
      { status: 500 }
    );
  }
}
