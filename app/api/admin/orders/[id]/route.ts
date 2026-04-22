import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

const ALLOWED_STATUSES = [
  "PAID",
  "SUPPLIER_ORDERED",
  "SUPPLIER_SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as {
    status?: AllowedStatus;
    supplierOrderReference?: string;
    shippingCarrier?: string;
    trackingNumber?: string;
    fulfillmentNotes?: string;
  };

  if (body.status && !ALLOWED_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const data: Record<string, string | Date | null> = {};
  if (body.status) data.status = body.status;
  if (body.supplierOrderReference !== undefined) {
    data.supplierOrderReference = body.supplierOrderReference.trim() || null;
  }
  if (body.shippingCarrier !== undefined) {
    data.shippingCarrier = body.shippingCarrier.trim() || null;
  }
  if (body.trackingNumber !== undefined) {
    data.trackingNumber = body.trackingNumber.trim() || null;
  }
  if (body.fulfillmentNotes !== undefined) {
    data.fulfillmentNotes = body.fulfillmentNotes.trim() || null;
  }

  if (body.status === "SUPPLIER_ORDERED") {
    data.supplierOrderedAt = new Date();
  }
  if (body.status === "SUPPLIER_SHIPPED") {
    data.supplierShippedAt = new Date();
  }
  if (body.status === "DELIVERED") {
    data.deliveredAt = new Date();
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No updatable fields" }, { status: 400 });
  }

  try {
    const order = await prisma.order.update({
      where: { id },
      data,
    });
    return NextResponse.json(order);
  } catch {
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
