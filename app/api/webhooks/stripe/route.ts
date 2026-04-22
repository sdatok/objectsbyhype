import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const sig = (await headers()).get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET missing");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, sig!, secret);
  } catch (err) {
    console.error("[stripe webhook] signature", err);
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId =
      session.metadata?.orderId ?? session.client_reference_id ?? null;
    if (!orderId) {
      console.error("[stripe webhook] no orderId on session", session.id);
      return NextResponse.json({ received: true });
    }

    try {
      await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { lineItems: true },
        });
        if (!order) {
          console.error("[stripe webhook] order not found", orderId);
          return;
        }
        if (order.status !== "PENDING") {
          return;
        }

        for (const li of order.lineItems) {
          const updated = await tx.productSizeStock.updateMany({
            where: {
              productId: li.productId,
              size: li.size,
              quantity: { gte: li.quantity },
            },
            data: { quantity: { decrement: li.quantity } },
          });
          if (updated.count === 0) {
            console.error(
              "[stripe webhook] stock failed",
              li.productId,
              li.size,
              li.quantity
            );
            throw new Error("Insufficient stock");
          }
        }

        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null;

        const finalEmail =
          session.customer_details?.email ?? order.email ?? "";

        await tx.order.update({
          where: { id: orderId },
          data: {
            status: "PAID",
            stripePaymentIntentId: paymentIntentId,
            email: finalEmail || order.email,
          },
        });

        if (order.welcomeDiscountApplied && order.clerkUserId) {
          await tx.customerProfile.upsert({
            where: { clerkUserId: order.clerkUserId },
            create: {
              clerkUserId: order.clerkUserId,
              email: finalEmail || "unknown",
              welcomeDiscountUsed: true,
            },
            update: {
              welcomeDiscountUsed: true,
              ...(finalEmail ? { email: finalEmail } : {}),
            },
          });
        }

        const productIds = [...new Set(order.lineItems.map((l) => l.productId))];
        for (const pid of productIds) {
          const agg = await tx.productSizeStock.aggregate({
            where: { productId: pid },
            _sum: { quantity: true },
          });
          const sum = agg._sum.quantity ?? 0;
          const p = await tx.product.findUnique({ where: { id: pid } });
          if (!p) continue;
          const nextStatus =
            sum === 0
              ? "SOLD"
              : p.status === "SOLD" && sum > 0
                ? "ACTIVE"
                : p.status;
          await tx.product.update({
            where: { id: pid },
            data: { quantity: sum, status: nextStatus },
          });
        }
      });
    } catch (e) {
      console.error("[stripe webhook] transaction", e);
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
