import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { GAME_CONFIG_ID, getOrCreateGameConfig } from "@/lib/game-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getOrCreateGameConfig();
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
      windowHours?: number;
      gameSpeed?: number;
      maxMisses?: number;
      taskBaseSeconds?: number;
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
    if (typeof body.windowHours === "number") {
      const n = Math.floor(body.windowHours);
      if (n < 1 || n > 24 * 30) {
        return NextResponse.json(
          { error: "Window hours must be between 1 and 720" },
          { status: 400 }
        );
      }
      data.windowHours = n;
    }
    if (typeof body.gameSpeed === "number") {
      if (body.gameSpeed < 0.25 || body.gameSpeed > 4) {
        return NextResponse.json(
          { error: "Game speed must be between 0.25 and 4" },
          { status: 400 }
        );
      }
      data.gameSpeed = body.gameSpeed;
    }
    if (typeof body.maxMisses === "number") {
      const n = Math.floor(body.maxMisses);
      if (n < 1 || n > 10) {
        return NextResponse.json(
          { error: "Max misses must be between 1 and 10" },
          { status: 400 }
        );
      }
      data.maxMisses = n;
    }
    if (typeof body.taskBaseSeconds === "number") {
      const n = Math.floor(body.taskBaseSeconds);
      if (n < 2 || n > 30) {
        return NextResponse.json(
          { error: "Task base seconds must be between 2 and 30" },
          { status: 400 }
        );
      }
      data.taskBaseSeconds = n;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    await getOrCreateGameConfig();
    const updated = await prisma.gameConfig.update({
      where: { id: GAME_CONFIG_ID },
      data,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PUT /api/admin/game/config]", err);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
