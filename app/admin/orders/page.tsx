import Link from "next/link";
import { prisma } from "@/lib/db";
import OrderRowActions from "@/components/admin/OrderRowActions";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      lineItems: true,
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

      <div className="bg-white border border-neutral-200 rounded overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-[12px]">
          <thead className="border-b border-neutral-200 text-[10px] uppercase tracking-widest text-neutral-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Promo</th>
              <th className="px-4 py-3">Fulfillment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-3 whitespace-nowrap text-neutral-600">
                  {o.createdAt.toLocaleString()}
                </td>
                <td className="px-4 py-3">{o.status}</td>
                <td className="px-4 py-3 font-medium">
                  ${Number(o.total).toFixed(2)}
                </td>
                <td className="px-4 py-3 max-w-[200px] truncate">
                  {o.email ?? "—"}
                </td>
                <td className="px-4 py-3 text-neutral-600">
                  {o.lineItems.map((l) => (
                    <div key={l.id}>
                      {l.name} / {l.size} ×{l.quantity}
                    </div>
                  ))}
                </td>
                <td className="px-4 py-3">
                  {o.promo?.code ?? "—"}
                  {o.welcomeDiscountApplied && (
                    <span className="block text-[10px] text-neutral-400">
                      welcome
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  <OrderRowActions
                    orderId={o.id}
                    currentStatus={
                      o.status === "PENDING" ? "PAID" : (o.status as "PAID" | "SUPPLIER_ORDERED" | "SUPPLIER_SHIPPED" | "DELIVERED" | "CANCELLED")
                    }
                    supplierOrderReference={o.supplierOrderReference ?? ""}
                    shippingCarrier={o.shippingCarrier ?? ""}
                    trackingNumber={o.trackingNumber ?? ""}
                    fulfillmentNotes={o.fulfillmentNotes ?? ""}
                  />
                  <div className="mt-2 text-[10px] text-neutral-500 space-y-0.5">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && (
          <p className="p-8 text-center text-[12px] text-neutral-400">
            No orders yet
          </p>
        )}
      </div>
    </div>
  );
}
