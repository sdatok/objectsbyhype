import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { SURVIVOR_CONFIG_ID } from "@/lib/survivor-config";

export const dynamic = "force-dynamic";

interface UpdateBody {
  enabled?: boolean;
  prizeTitle?: string;
  prizeDescription?: string;
  matchSeconds?: number;
}

export async function PUT(request: Request) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as UpdateBody;
    const data: {
      enabled?: boolean;
      prizeTitle?: string;
      prizeDescription?: string | null;
      matchSeconds?: number;
    } = {};

    if (typeof body.enabled === "boolean") data.enabled = body.enabled;
    if (typeof body.prizeTitle === "string") {
      const t = body.prizeTitle.trim();
      if (!t) {
        return NextResponse.json(
          { error: "Prize title is required." },
          { status: 400 }
        );
      }
      data.prizeTitle = t.slice(0, 80);
    }
    if (typeof body.prizeDescription === "string") {
      data.prizeDescription =
        body.prizeDescription.trim().slice(0, 500) || null;
    }
    if (typeof body.matchSeconds === "number") {
      const n = Math.round(body.matchSeconds);
      if (n < 30 || n > 3600) {
        return NextResponse.json(
          { error: "Match seconds must be between 30 and 3600." },
          { status: 400 }
        );
      }
      data.matchSeconds = n;
    }

    await prisma.survivorConfig.upsert({
      where: { id: SURVIVOR_CONFIG_ID },
      create: { id: SURVIVOR_CONFIG_ID, ...data },
      update: data,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PUT /api/admin/survivor/config]", err);
    return NextResponse.json(
      { error: "Could not save config." },
      { status: 500 }
    );
  }
}
