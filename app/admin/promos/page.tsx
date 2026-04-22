import Link from "next/link";
import { prisma } from "@/lib/db";
import NewPromoForm from "./NewPromoForm";
import PromoTableActions from "./PromoTableActions";

export const dynamic = "force-dynamic";

export default async function AdminPromosPage() {
  const promos = await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
  });

  const promoRows = promos.map((p) => ({
    id: p.id,
    code: p.code,
    type: p.type as "PERCENT" | "FIXED",
    value: Number(p.value),
    active: p.active,
  }));

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/admin"
          className="text-[11px] uppercase tracking-widest text-neutral-500 hover:text-black transition-colors"
        >
          ← Admin home
        </Link>
        <h1 className="text-[18px] font-bold mt-3">Promo codes</h1>
        <p className="text-[12px] text-neutral-500 mt-0.5">
          Percent or fixed USD off. Codes are case-insensitive.
        </p>
      </div>

      <NewPromoForm />

      <div className="bg-white border border-neutral-200 rounded overflow-hidden">
        <table className="w-full text-left text-[12px]">
          <thead className="border-b border-neutral-200 text-[10px] uppercase tracking-widest text-neutral-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <PromoTableActions promos={promoRows} />
        </table>
        {promoRows.length === 0 && (
          <p className="p-8 text-center text-[12px] text-neutral-400">
            No promo codes yet
          </p>
        )}
      </div>
    </div>
  );
}
