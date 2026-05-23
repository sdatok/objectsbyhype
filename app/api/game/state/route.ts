import { NextResponse } from "next/server";
import { buildPublicGameState } from "@/lib/game-config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await buildPublicGameState();
    return NextResponse.json(state);
  } catch (err) {
    console.error("[GET /api/game/state]", err);
    return NextResponse.json(
      { error: "Failed to load game state" },
      { status: 500 }
    );
  }
}
