import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { revertWheelSpin, WheelSpinError } from "@/lib/wheel-spin";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await revertWheelSpin(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof WheelSpinError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("[DELETE /api/admin/wheel/spins/[id]]", err);
    return NextResponse.json({ error: "Revert failed" }, { status: 500 });
  }
}
