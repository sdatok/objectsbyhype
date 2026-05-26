import { NextResponse } from "next/server";
import { buildPublicSurvivorState } from "@/lib/survivor-config";

export const dynamic = "force-dynamic";

/** Public read of lobby/match status. Used by the /survivor page and the
 *  admin controls to poll for current state. Leaks nothing sensitive. */
export async function GET() {
  try {
    const state = await buildPublicSurvivorState();
    return NextResponse.json(state);
  } catch (err) {
    console.error("[GET /api/survivor/state]", err);
    return NextResponse.json(
      { error: "Could not read survivor state." },
      { status: 500 }
    );
  }
}
