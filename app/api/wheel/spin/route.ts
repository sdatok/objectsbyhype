import { NextResponse } from "next/server";
import {
  executeWheelSpin,
  validateWheelCode,
  WheelSpinError,
} from "@/lib/wheel-spin";

export const dynamic = "force-dynamic";

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return request.headers.get("x-real-ip");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { code?: string };
    if (!body?.code || typeof body.code !== "string") {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    const result = await executeWheelSpin(body.code, clientIp(request));
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof WheelSpinError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: 400 }
      );
    }
    console.error("[POST /api/wheel/spin]", err);
    return NextResponse.json({ error: "Spin failed" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { code?: string };
    if (!body?.code || typeof body.code !== "string") {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    const result = await validateWheelCode(body.code);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 400 }
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[PUT /api/wheel/spin]", err);
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
