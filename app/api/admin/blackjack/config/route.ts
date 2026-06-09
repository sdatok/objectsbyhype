import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import {
  BLACKJACK_CONFIG_ID,
  BLACKJACK_DEFAULT_ROUND_SECONDS,
  clampRoundSeconds,
  getOrCreateBlackjackConfig,
} from "@/lib/blackjack-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const config = await getOrCreateBlackjackConfig();
  return NextResponse.json(config);
}

export async function PUT(request: Request) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      enabled?: boolean;
      prizeTitle?: string;
      prizeDescription?: string | null;
      roundSeconds?: number;
    };

    const data: Record<string, unknown> = {};
    if (typeof body.enabled === "boolean") data.enabled = body.enabled;
    if (typeof body.prizeTitle === "string") {
      const trimmed = body.prizeTitle.trim();
      if (!trimmed) {
        return NextResponse.json(
          { error: "Prize title is required" },
          { status: 400 }
        );
      }
      data.prizeTitle = trimmed.slice(0, 80);
    }
    if (body.prizeDescription !== undefined) {
      const trimmed =
        typeof body.prizeDescription === "string"
          ? body.prizeDescription.trim().slice(0, 500)
          : "";
      data.prizeDescription = trimmed || null;
    }
    if (typeof body.roundSeconds === "number") {
      data.roundSeconds = clampRoundSeconds(body.roundSeconds);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    await getOrCreateBlackjackConfig();
    const updated = await prisma.blackjackConfig.update({
      where: { id: BLACKJACK_CONFIG_ID },
      data,
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PUT /api/admin/blackjack/config]", err);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}

export async function POST() {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = await getOrCreateBlackjackConfig();
    if (config.currentRoundId) {
      const current = await prisma.blackjackRound.findUnique({
        where: { id: config.currentRoundId },
      });
      if (current?.status === "OPEN") {
        const { forceFinishCurrentRound } = await import("@/lib/blackjack-config");
        await forceFinishCurrentRound();
      }
    }

    const round = await prisma.blackjackRound.create({
      data: {
        prizeTitle: config.prizeTitle,
        endsAt: new Date(
          Date.now() +
            (config.roundSeconds || BLACKJACK_DEFAULT_ROUND_SECONDS) * 1000
        ),
      },
    });

    const updated = await prisma.blackjackConfig.update({
      where: { id: BLACKJACK_CONFIG_ID },
      data: { currentRoundId: round.id },
    });

    return NextResponse.json({ config: updated, round });
  } catch (err) {
    console.error("[POST /api/admin/blackjack/config]", err);
    return NextResponse.json(
      { error: "Failed to start new round" },
      { status: 500 }
    );
  }
}
