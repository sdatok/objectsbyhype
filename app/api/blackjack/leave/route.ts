import { NextResponse } from "next/server";
import { leaveTable } from "@/lib/blackjack-table";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LeaveBody {
  email?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LeaveBody;
    const email = (body.email ?? "").trim().toLowerCase();

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    await leaveTable(email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not leave";
    console.error("[POST /api/blackjack/leave]", err);
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
