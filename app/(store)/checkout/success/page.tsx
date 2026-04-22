import Link from "next/link";
import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import ClearCartOnSuccess from "@/components/store/ClearCartOnSuccess";

interface PageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({ searchParams }: PageProps) {
  const { session_id } = await searchParams;
  if (!session_id) redirect("/shop");

  const stripe = getStripe();
  let paid = false;
  let orderTotal: string | null = null;

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const orderId = session.metadata?.orderId ?? session.client_reference_id;
    if (orderId) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { status: true, total: true },
      });
      paid = order?.status === "PAID";
      if (order) orderTotal = Number(order.total).toFixed(2);
    }
  } catch {
    paid = false;
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <ClearCartOnSuccess />
      <h1 className="text-[13px] uppercase tracking-widest font-bold">
        Thank you
      </h1>
      <p className="text-[13px] text-neutral-600 mt-4 leading-relaxed">
        {paid
          ? `Your payment was received${orderTotal ? ` — total $${orderTotal}` : ""}. We’ll follow up by email with shipping details.`
          : "We’re confirming your payment. If this page doesn’t update, check your email for a receipt."}
      </p>
      <Link
        href="/shop"
        className="inline-block mt-8 text-[11px] uppercase tracking-widest border-b border-black pb-0.5"
      >
        Continue shopping
      </Link>
    </div>
  );
}
