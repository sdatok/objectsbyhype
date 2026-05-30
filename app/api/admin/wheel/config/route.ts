import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  WHEEL_CONFIG_ID,
  DEFAULT_TIER_WEIGHTS,
} from "@/lib/wheel-config";
import { getOrCreateWheelConfig } from "@/lib/wheel-db";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      enabled?: boolean;
      commonWeight?: number;
      rareWeight?: number;
      jackpotWeight?: number;
    };

    await getOrCreateWheelConfig();
    const data: Record<string, unknown> = {};

    if (typeof body.enabled === "boolean") data.enabled = body.enabled;
    for (const [key, def] of [
      ["commonWeight", DEFAULT_TIER_WEIGHTS.commonWeight],
      ["rareWeight", DEFAULT_TIER_WEIGHTS.rareWeight],
      ["jackpotWeight", DEFAULT_TIER_WEIGHTS.jackpotWeight],
    ] as const) {
      const val = body[key as keyof typeof body];
      if (typeof val === "number") {
        const n = Math.floor(val);
        if (n < 1 || n > 100) {
          return NextResponse.json(
            { error: `${key} must be between 1 and 100` },
            { status: 400 }
          );
        }
        data[key] = n;
      }
    }

    const updated = await prisma.wheelConfig.update({
      where: { id: WHEEL_CONFIG_ID },
      data,
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PUT /api/admin/wheel/config]", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
