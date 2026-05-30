import { NextResponse } from "next/server";
import { executeDemoWheelSpin, WheelSpinError } from "@/lib/wheel-spin";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await executeDemoWheelSpin();
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof WheelSpinError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: 400 }
      );
    }
    console.error("[POST /api/wheel/demo-spin]", err);
    return NextResponse.json({ error: "Demo spin failed" }, { status: 500 });
  }
}
