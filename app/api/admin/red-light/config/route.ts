import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import {
  getOrCreateRedLightConfig,
  RED_LIGHT_CONFIG_ID,
  clampMatchSeconds,
  RLGL_DEFAULT_MATCH_SECONDS,
} from "@/lib/red-light-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const config = await getOrCreateRedLightConfig();
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

    const config = await prisma.redLightConfig.update({
      where: { id: RED_LIGHT_CONFIG_ID },
      data: {
        enabled: body.enabled,
        prizeTitle: body.prizeTitle?.trim(),
        prizeDescription: body.prizeDescription,
        matchSeconds: body.matchSeconds
          ? clampMatchSeconds(body.matchSeconds, RLGL_DEFAULT_MATCH_SECONDS)
          : undefined,
      },
    });

    return NextResponse.json(config);
  } catch (err) {
    console.error("[PUT /api/admin/red-light/config]", err);
    return NextResponse.json({ error: "Could not update config." }, { status: 500 });
  }
}
