import { NextResponse } from "next/server";
import { buildPublicGiveawayWheelState } from "@/lib/giveaway-wheel-spin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await buildPublicGiveawayWheelState();
    return NextResponse.json(state);
  } catch (err) {
    console.error("[GET /api/giveaway-wheel/state]", err);
    return NextResponse.json({ error: "Could not load wheel state" }, { status: 500 });
  }
}
