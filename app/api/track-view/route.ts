import { NextResponse } from "next/server";
import { recordPageView } from "@/lib/page-view";

export const dynamic = "force-dynamic";

/**
 * Storefront page-view beacon. Called once per client-side mount from
 * `<PageViewTracker />`. Returns immediately; the DB write is best-effort.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { path?: string };
    const path = typeof body.path === "string" ? body.path : null;
    if (path) {
      await recordPageView(path);
    }
  } catch {
    // Swallow — a broken beacon never breaks the page.
  }
  return NextResponse.json({ ok: true });
}
