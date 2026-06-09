import { NextResponse } from "next/server";
import { saveCreditsToBank } from "@/lib/blackjack-economy";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SaveBody {
  email?: string;
  amount?: number;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SaveBody;
    const email = (body.email ?? "").trim().toLowerCase();
    const amount =
      body.amount != null && Number.isFinite(body.amount)
        ? Math.floor(body.amount)
        : undefined;

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const saved = await saveCreditsToBank(email, amount);

    return NextResponse.json({ saved });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not save credits";
    console.error("[POST /api/blackjack/save]", err);
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
