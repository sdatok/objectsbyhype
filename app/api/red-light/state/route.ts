import { NextResponse } from "next/server";
import { buildPublicRedLightState } from "@/lib/red-light-config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await buildPublicRedLightState();
    return NextResponse.json(state);
  } catch (err) {
    console.error("[GET /api/red-light/state]", err);
    return NextResponse.json({ error: "Failed to load state" }, { status: 500 });
  }
}
