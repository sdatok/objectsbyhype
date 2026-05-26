import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Admin-only: probe the Railway game server so we can confirm deploy version. */
export async function GET() {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = process.env.SURVIVOR_GAME_SERVER_URL;
  if (!baseUrl) {
    return NextResponse.json(
      { ok: false, error: "SURVIVOR_GAME_SERVER_URL not configured." },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/healthz`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.json().catch(() => ({}));
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      url: baseUrl,
      body,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      url: baseUrl,
      error: err instanceof Error ? err.message : "fetch failed",
    });
  }
}
