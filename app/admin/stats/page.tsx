import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminStatsPage() {
  const [paidCount, paidRevenue, profileCount, pendingCount] = await Promise.all([
    prisma.order.count({ where: { status: "PAID" } }),
    prisma.order.aggregate({
      where: { status: "PAID" },
      _sum: { total: true },
    }),
    prisma.customerProfile.count(),
    prisma.order.count({ where: { status: "PENDING" } }),
  ]);

  const revenue = Number(paidRevenue._sum.total ?? 0);

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/admin"
          className="text-[11px] uppercase tracking-widest text-neutral-500 hover:text-black transition-colors"
        >
          ← Admin home
        </Link>
        <h1 className="text-[18px] font-bold mt-3">Store stats</h1>
        <p className="text-[12px] text-neutral-500 mt-0.5">
          From your database. Page views are in{" "}
          <a
            href="https://vercel.com/docs/analytics"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            Vercel Analytics
          </a>
          .
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded p-5">
          <p className="text-[10px] uppercase tracking-widest text-neutral-500">
            Paid orders
          </p>
          <p className="text-[24px] font-bold mt-2">{paidCount}</p>
        </div>
        <div className="bg-white border border-neutral-200 rounded p-5">
          <p className="text-[10px] uppercase tracking-widest text-neutral-500">
            Paid revenue (USD)
          </p>
          <p className="text-[24px] font-bold mt-2">${revenue.toFixed(2)}</p>
        </div>
        <div className="bg-white border border-neutral-200 rounded p-5">
          <p className="text-[10px] uppercase tracking-widest text-neutral-500">
            Customer accounts
          </p>
          <p className="text-[24px] font-bold mt-2">{profileCount}</p>
          <p className="text-[10px] text-neutral-400 mt-1">
            Profiles created after sign-in
          </p>
        </div>
        <div className="bg-white border border-neutral-200 rounded p-5">
          <p className="text-[10px] uppercase tracking-widest text-neutral-500">
            Pending checkouts
          </p>
          <p className="text-[24px] font-bold mt-2">{pendingCount}</p>
          <p className="text-[10px] text-neutral-400 mt-1">
            Abandoned or in progress
          </p>
        </div>
      </div>
    </div>
  );
}
