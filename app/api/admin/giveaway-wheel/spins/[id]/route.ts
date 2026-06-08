import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import {
  revertGiveawayWheelSpin,
  GiveawayWheelSpinError,
} from "@/lib/giveaway-wheel-spin";

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
    await revertGiveawayWheelSpin(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof GiveawayWheelSpinError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[DELETE /api/admin/giveaway-wheel/spins/[id]]", err);
    return NextResponse.json({ error: "Remove failed" }, { status: 500 });
  }
}
