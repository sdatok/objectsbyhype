import { NextResponse } from "next/server";
import { buildPublicWheelState } from "@/lib/wheel-spin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await buildPublicWheelState();
    return NextResponse.json(state);
  } catch (err) {
    console.error("[GET /api/wheel/state]", err);
    return NextResponse.json(
      { error: "Failed to load wheel state" },
      { status: 500 }
    );
  }
}
