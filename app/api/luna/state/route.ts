import { NextResponse } from "next/server";
import { buildPublicLunaState } from "@/lib/luna-config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await buildPublicLunaState();
    return NextResponse.json(state);
  } catch (err) {
    console.error("[GET /api/luna/state]", err);
    return NextResponse.json({ error: "Failed to load state" }, { status: 500 });
  }
}
