import Link from "next/link";
import { prisma } from "@/lib/db";
import OrderRowActions from "@/components/admin/OrderRowActions";
import OrderFulfillmentCard, {
  CopyButton,
  formatAddress,
  type FulfillmentLineItem,
} from "@/components/admin/OrderFulfillmentCard";
import type { ShippingAddress } from "@/types";

export const dynamic = "force-dynamic";

function toShippingAddress(json: unknown): ShippingAddress | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  return {
    name: typeof o.name === "string" ? o.name : null,
    phone: typeof o.phone === "string" ? o.phone : null,
    line1: typeof o.line1 === "string" ? o.line1 : null,
    line2: typeof o.line2 === "string" ? o.line2 : null,
    city: typeof o.city === "string" ? o.city : null,
    state: typeof o.state === "string" ? o.state : null,
    postalCode: typeof o.postalCode === "string" ? o.postalCode : null,
    country: typeof o.country === "string" ? o.country : null,
  };
}

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      lineItems: {
        include: {
          product: {
            select: {
              etsyUrl: true,
              etsyNote: true,
              etsyShop: true,
            },
          },
          variant: {
            select: {
              etsyUrl: true,
              etsyNote: true,
            },
          },
        },
      },
      promo: { select: { code: true } },
    },
  });

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/admin"
          className="text-[11px] uppercase tracking-widest text-neutral-500 hover:text-black transition-colors"
        >
          ← Admin home
        </Link>
        <h1 className="text-[18px] font-bold mt-3">Orders</h1>
        <p className="text-[12px] text-neutral-500 mt-0.5">
          Last 100 orders (newest first)
        </p>
      </div>

      {orders.length === 0 && (
        <div className="bg-white border border-neutral-200 rounded p-8 text-center">
          <p className="text-[12px] text-neutral-400">No orders yet</p>
        </div>
      )}

      {/* Mobile: stacked fulfillment cards (no horizontal scroll) */}
      <div className="md:hidden space-y-4">
        {orders.map((o) => {
          const shipping = toShippingAddress(o.shippingAddress);
          const lineItems: FulfillmentLineItem[] = o.lineItems.map((li) => ({
            id: li.id,
            name: li.name,
            brand: li.brand,
            size: li.size,
            quantity: li.quantity,
            unitPrice: Number(li.unitPrice),
            variantLabel: li.variantLabel,
            etsyUrl: li.variant?.etsyUrl ?? li.product.etsyUrl ?? null,
            etsyNote: li.variant?.etsyNote ?? li.product.etsyNote ?? null,
            etsyShop: li.product.etsyShop ?? null,
          }));
          return (
            <div key={o.id} className="space-y-3">
              <OrderFulfillmentCard
                orderId={o.id}
                email={o.email}
                total={Number(o.total)}
                status={o.status}
                createdAt={o.createdAt.toISOString()}
                promoCode={o.promo?.code ?? null}
                welcomeDiscountApplied={o.welcomeDiscountApplied}
                shippingAddress={shipping}
                lineItems={lineItems}
              />
              <div className="bg-white border border-neutral-200 rounded p-4">
                <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-3">
                  Fulfillment
                </p>
                <OrderRowActions
                  orderId={o.id}
                  currentStatus={
                    o.status === "PENDING"
                      ? "PAID"
                      : (o.status as
                          | "PAID"
                          | "SUPPLIER_ORDERED"
                          | "SUPPLIER_SHIPPED"
                          | "DELIVERED"
                          | "CANCELLED")
                  }
                  supplierOrderReference={o.supplierOrderReference ?? ""}
                  shippingCarrier={o.shippingCarrier ?? ""}
                  trackingNumber={o.trackingNumber ?? ""}
                  fulfillmentNotes={o.fulfillmentNotes ?? ""}
                  etsyUrlsForNotes={lineItems
                    .map((li) => li.etsyUrl)
                    .filter((u): u is string => Boolean(u))}
                />
                <div className="mt-3 text-[10px] text-neutral-500 space-y-0.5">
                  {o.supplierOrderedAt && (
                    <p>Ordered: {o.supplierOrderedAt.toLocaleDateString()}</p>
                  )}
                  {o.supplierShippedAt && (
                    <p>Shipped: {o.supplierShippedAt.toLocaleDateString()}</p>
                  )}
                  {o.deliveredAt && (
                    <p>Delivered: {o.deliveredAt.toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: existing table layout */}
      <div className="hidden md:block bg-white border border-neutral-200 rounded overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-[12px]">
          <thead className="border-b border-neutral-200 text-[10px] uppercase tracking-widest text-neutral-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Ship to</th>
              <th className="px-4 py-3">Fulfillment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {orders.map((o) => {
              const shipping = toShippingAddress(o.shippingAddress);
              const lineItems: FulfillmentLineItem[] = o.lineItems.map(
                (li) => ({
                  id: li.id,
                  name: li.name,
                  brand: li.brand,
                  size: li.size,
                  quantity: li.quantity,
                  unitPrice: Number(li.unitPrice),
                  variantLabel: li.variantLabel,
                  etsyUrl:
                    li.variant?.etsyUrl ?? li.product.etsyUrl ?? null,
                  etsyNote:
                    li.variant?.etsyNote ?? li.product.etsyNote ?? null,
                  etsyShop: li.product.etsyShop ?? null,
                })
              );
              return (
                <tr key={o.id} className="align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-neutral-600">
                    {o.createdAt.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{o.status}</td>
                  <td className="px-4 py-3 font-medium">
                    ${Number(o.total).toFixed(2)}
                    {(o.promo?.code || o.welcomeDiscountApplied) && (
                      <span className="block text-[10px] text-neutral-400">
                        {o.promo?.code ?? ""}
                        {o.welcomeDiscountApplied ? " welcome" : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-[200px] truncate">
                    {o.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 min-w-[280px]">
                    <div className="space-y-2">
                      {lineItems.map((li) => (
                        <div
                          key={li.id}
                          className="flex items-start justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="leading-snug">
                              {li.name} / {li.size} ×{li.quantity}
                              {li.variantLabel && (
                                <span className="text-neutral-400">
                                  {" "}
                                  · {li.variantLabel}
                                </span>
                              )}
                            </p>
                          </div>
                          {li.etsyUrl && (
                            <a
                              href={li.etsyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open Etsy listing to re-order"
                              className="shrink-0 inline-flex items-center justify-center min-h-[28px] px-2 text-[10px] uppercase tracking-widest border border-black bg-white hover:bg-black hover:text-white transition-colors"
                            >
                              Etsy ↗
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 min-w-[220px] align-top">
                    {shipping ? (
                      <div className="space-y-2">
                        <pre className="text-[11px] font-sans whitespace-pre-wrap break-words leading-snug text-neutral-700">
                          {formatAddress(shipping)}
                        </pre>
                        <CopyButton
                          text={formatAddress(shipping)}
                          label="Copy address"
                          className="inline-flex items-center justify-center min-h-[28px] px-2 text-[10px] uppercase tracking-widest border border-neutral-300 bg-white hover:border-black transition-colors"
                        />
                        {lineItems.some((li) => li.etsyNote) && (
                          <CopyButton
                            text={
                              lineItems.find((li) => li.etsyNote)?.etsyNote ??
                              ""
                            }
                            label="Copy Etsy note"
                            className="inline-flex items-center justify-center min-h-[28px] px-2 ml-2 text-[10px] uppercase tracking-widest border border-neutral-300 bg-white hover:border-black transition-colors"
                          />
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-neutral-400 italic">
                        No address
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <OrderRowActions
                      orderId={o.id}
                      currentStatus={
                        o.status === "PENDING"
                          ? "PAID"
                          : (o.status as
                              | "PAID"
                              | "SUPPLIER_ORDERED"
                              | "SUPPLIER_SHIPPED"
                              | "DELIVERED"
                              | "CANCELLED")
                      }
                      supplierOrderReference={o.supplierOrderReference ?? ""}
                      shippingCarrier={o.shippingCarrier ?? ""}
                      trackingNumber={o.trackingNumber ?? ""}
                      fulfillmentNotes={o.fulfillmentNotes ?? ""}
                      etsyUrlsForNotes={lineItems
                        .map((li) => li.etsyUrl)
                        .filter((u): u is string => Boolean(u))}
                    />
                    <div className="mt-2 text-[10px] text-neutral-500 space-y-0.5">
                      {o.supplierOrderedAt && (
                        <p>
                          Ordered: {o.supplierOrderedAt.toLocaleDateString()}
                        </p>
                      )}
                      {o.supplierShippedAt && (
                        <p>
                          Shipped: {o.supplierShippedAt.toLocaleDateString()}
                        </p>
                      )}
                      {o.deliveredAt && (
                        <p>Delivered: {o.deliveredAt.toLocaleDateString()}</p>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
