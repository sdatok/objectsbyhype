import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import {
  allocateDiscountToUnitPrices,
  validateCartLines,
  resolvePromo,
  resolveWelcomeDiscount,
  type CartLineInput,
} from "@/lib/checkout";

export const dynamic = "force-dynamic";

function appOrigin(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (!url) {
    throw new Error("Set NEXT_PUBLIC_APP_URL (e.g. http://localhost:3000)");
  }
  return url.replace(/\/$/, "");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      items?: CartLineInput[];
      promoCode?: string;
      useWelcomeDiscount?: boolean;
    };

    const items = body.items ?? [];
    const { userId } = await auth();
    const user = userId ? await currentUser() : null;
    const email =
      user?.primaryEmailAddress?.emailAddress ??
      user?.emailAddresses?.[0]?.emailAddress ??
      undefined;

    const validated = await validateCartLines(items);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const subtotal = validated.lines.reduce(
      (s, l) => s + l.unitPrice * l.quantity,
      0
    );

    const hasPromo = Boolean(body.promoCode?.trim());
    const wantsWelcome = Boolean(body.useWelcomeDiscount);

    if (hasPromo && wantsWelcome) {
      return NextResponse.json(
        { error: "Use either a promo code or the welcome discount, not both" },
        { status: 400 }
      );
    }

    let discountTotal = 0;
    let promoId: string | null = null;
    let welcomeApplied = false;

    if (hasPromo) {
      const promoRes = await resolvePromo(
        body.promoCode,
        subtotal,
        userId ?? null
      );
      if (!promoRes.ok) {
        return NextResponse.json({ error: promoRes.error }, { status: 400 });
      }
      if (promoRes.promo) {
        discountTotal = promoRes.discount;
        promoId = promoRes.promo.id;
      }
    } else if (wantsWelcome) {
      const w = await resolveWelcomeDiscount(true, userId ?? null, subtotal);
      if (!w.ok) {
        return NextResponse.json({ error: w.error }, { status: 400 });
      }
      discountTotal = w.discount;
      welcomeApplied = discountTotal > 0;
    }

    const discountedLines = allocateDiscountToUnitPrices(
      validated.lines,
      discountTotal
    );
    const total = Math.max(
      0,
      Math.round((subtotal - discountTotal) * 100) / 100
    );

    const order = await prisma.order.create({
      data: {
        status: "PENDING",
        subtotal,
        discountTotal,
        total,
        email: email ?? null,
        clerkUserId: userId ?? null,
        welcomeDiscountApplied: welcomeApplied,
        promoCodeId: promoId,
        lineItems: {
          create: discountedLines.map((l) => ({
            productId: l.productId,
            size: l.size,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            name: l.name,
            brand: l.brand,
          })),
        },
      },
    });

    const stripe = getStripe();
    const origin = appOrigin();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: discountedLines.map((l) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: `${l.brand} — ${l.name}`,
            description: `Size ${l.size}`,
          },
          unit_amount: Math.round(l.unitPrice * 100),
        },
        quantity: l.quantity,
      })),
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop?checkout=cancelled`,
      client_reference_id: order.id,
      metadata: {
        orderId: order.id,
        clerkUserId: userId ?? "",
      },
      ...(email ? { customer_email: email } : {}),
    });

    if (!session.id) {
      await prisma.order.delete({ where: { id: order.id } });
      return NextResponse.json(
        { error: "Could not start checkout" },
        { status: 500 }
      );
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Missing checkout URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[checkout]", e);
    const message = e instanceof Error ? e.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
