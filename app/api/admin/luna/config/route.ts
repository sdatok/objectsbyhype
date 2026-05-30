import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import {
  getOrCreateLunaConfig,
  LUNA_CONFIG_ID,
  clampMatchSeconds,
} from "@/lib/luna-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const config = await getOrCreateLunaConfig();
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
      matchSeconds?: number;
    };

    const config = await prisma.escapeLunaConfig.update({
      where: { id: LUNA_CONFIG_ID },
      data: {
        enabled: body.enabled,
        prizeTitle: body.prizeTitle?.trim(),
        prizeDescription: body.prizeDescription,
        matchSeconds: body.matchSeconds
          ? clampMatchSeconds(body.matchSeconds, 420)
          : undefined,
      },
    });

    return NextResponse.json(config);
  } catch (err) {
    console.error("[PUT /api/admin/luna/config]", err);
    return NextResponse.json({ error: "Could not update config." }, { status: 500 });
  }
}
