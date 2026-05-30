import Link from "next/link";
import { prisma } from "@/lib/db";
import { initWheelData } from "@/lib/wheel-db";
import { buildWheelAdminStats } from "@/lib/wheel-spin";
import { currentMonthKey, formatMonthKey } from "@/lib/wheel-config";
import WheelConfigForm from "@/components/admin/wheel/WheelConfigForm";
import AddProMemberForm from "@/components/admin/wheel/AddProMemberForm";
import ProMemberTable from "@/components/admin/wheel/ProMemberTable";
import WheelPrizeTable from "@/components/admin/wheel/WheelPrizeTable";

export const dynamic = "force-dynamic";

export default async function AdminWheelPage() {
  await initWheelData();
  const monthKey = currentMonthKey();
  const stats = await buildWheelAdminStats(monthKey);
  const config = await prisma.wheelConfig.findUniqueOrThrow({
    where: { id: "default" },
  });

  const members = await prisma.wheelProMember.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      codes: { where: { monthKey }, take: 1 },
    },
  });

  const prizes = await prisma.wheelPrize.findMany({
    orderBy: { sortOrder: "asc" },
  });

  const spins = await prisma.wheelSpin.findMany({
    where: { monthKey },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { proMember: { select: { name: true, email: true } } },
  });

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin"
          className="text-[11px] uppercase tracking-widest text-neutral-500 hover:text-black transition-colors"
        >
          ← Admin home
        </Link>
        <h1 className="text-[18px] font-bold mt-3">Wheel of Hype</h1>
        <p className="text-[12px] text-neutral-500 mt-0.5">
          Pro-member monthly spin at <code>/wheelofhype</code> ·{" "}
          {formatMonthKey(monthKey)}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          ["Active pros", stats.activeMembers],
          ["MRR", `$${stats.mrrTotal.toFixed(0)}`],
          ["Codes issued", stats.codesIssued],
          ["Unused codes", stats.codesUnused],
          ["Spins", stats.spinsThisMonth],
          ["Prizes left", stats.totalPrizesRemaining],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="bg-white border border-neutral-200 rounded p-4"
          >
            <p className="text-[10px] uppercase tracking-widest text-neutral-500">
              {label}
            </p>
            <p className="text-xl font-bold mt-1 tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-8">
        <div className="space-y-6">
          <WheelConfigForm
            initial={{
              enabled: config.enabled,
              commonWeight: config.commonWeight,
              rareWeight: config.rareWeight,
              jackpotWeight: config.jackpotWeight,
            }}
          />
          <AddProMemberForm />
        </div>

        <ProMemberTable
          monthKey={monthKey}
          members={members.map((m) => ({
            id: m.id,
            name: m.name,
            email: m.email,
            monthlyPrice: Number(m.monthlyPrice),
            active: m.active,
            notes: m.notes,
            code: m.codes[0]?.code ?? null,
            codeUsed: !!m.codes[0]?.usedAt,
          }))}
        />
      </div>

      <WheelPrizeTable
        prizes={prizes.map((p) => ({
          id: p.id,
          label: p.label,
          tier: p.tier,
          quantityRemaining: p.quantityRemaining,
          quantityInitial: p.quantityInitial,
          active: p.active,
        }))}
      />

      <section>
        <h2 className="text-[11px] uppercase tracking-widest font-bold mb-4">
          Recent spins · {formatMonthKey(monthKey)}
        </h2>
        {spins.length === 0 ? (
          <p className="text-[12px] text-neutral-400 italic">No spins yet.</p>
        ) : (
          <div className="bg-white border border-neutral-200 rounded overflow-hidden">
            <table className="w-full text-left text-[12px]">
              <thead className="border-b border-neutral-200 text-[10px] uppercase tracking-widest text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Prize</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">When</th>
                </tr>
              </thead>
              <tbody>
                {spins.map((s) => (
                  <tr key={s.id} className="border-b border-neutral-100">
                    <td className="px-4 py-3">
                      <span className="font-medium">{s.proMember.name}</span>
                      <span className="text-neutral-500 text-[11px] ml-2">
                        {s.proMember.email}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{s.prizeLabel}</td>
                    <td className="px-4 py-3 text-[10px] uppercase tracking-widest">
                      {s.tier}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-neutral-500">
                      {s.createdAt.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
