import Link from "next/link";
import { prisma } from "@/lib/db";
import { initGiveawayWheelData } from "@/lib/giveaway-wheel-db";
import { buildGiveawayWheelAdminStats } from "@/lib/giveaway-wheel-spin";
import GiveawayWheelConfigForm from "@/components/admin/giveaway-wheel/GiveawayWheelConfigForm";
import GiveawayWheelCodeForm from "@/components/admin/giveaway-wheel/GiveawayWheelCodeForm";
import GiveawayWheelCodesTable from "@/components/admin/giveaway-wheel/GiveawayWheelCodesTable";
import GiveawayWheelPrizeTable from "@/components/admin/giveaway-wheel/GiveawayWheelPrizeTable";
import GiveawayWheelOddsBreakdown from "@/components/admin/giveaway-wheel/GiveawayWheelOddsBreakdown";
import GiveawayWheelRecentSpinsTable from "@/components/admin/giveaway-wheel/GiveawayWheelRecentSpinsTable";

export const dynamic = "force-dynamic";

export default async function AdminGiveawayWheelPage() {
  await initGiveawayWheelData();
  const stats = await buildGiveawayWheelAdminStats();
  const config = await prisma.giveawayWheelConfig.findUniqueOrThrow({
    where: { id: "default" },
  });

  const prizes = await prisma.giveawayWheelPrize.findMany({
    where: { label: { not: "__giveaway_catalog_version__" } },
    orderBy: { sortOrder: "asc" },
  });

  const codes = await prisma.giveawayWheelPlayCode.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      spin: { select: { prizeLabel: true } },
    },
  });

  const spins = await prisma.giveawayWheelSpin.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
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
        <h1 className="text-[18px] font-bold mt-3">Giveaway Wheel</h1>
        <p className="text-[12px] text-neutral-500 mt-0.5">
          Game-winner spins at <code>/giveawaywheel</code> · codes start with{" "}
          <code>GW-</code>
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ["Codes issued", stats.codesIssued],
          ["Unused codes", stats.codesUnused],
          ["Total spins", stats.spinsTotal],
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
        <GiveawayWheelConfigForm
          initial={{
            enabled: config.enabled,
            commonWeight: config.commonWeight,
            rareWeight: config.rareWeight,
            jackpotWeight: config.jackpotWeight,
          }}
        />
        <GiveawayWheelCodeForm />
      </div>

      <section>
        <h2 className="text-[11px] uppercase tracking-widest font-bold mb-4">
          Recent codes
        </h2>
        <GiveawayWheelCodesTable
          codes={codes.map((c) => ({
            id: c.id,
            code: c.code,
            winnerName: c.winnerName,
            winnerEmail: c.winnerEmail,
            source: c.source,
            notes: c.notes,
            usedAt: c.usedAt?.toISOString() ?? null,
            createdAt: c.createdAt.toISOString(),
            prizeLabel: c.spin?.prizeLabel ?? null,
          }))}
        />
      </section>

      <GiveawayWheelOddsBreakdown config={config} prizes={prizes} />

      <GiveawayWheelPrizeTable
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
          Recent spins
        </h2>
        <GiveawayWheelRecentSpinsTable
          spins={spins.map((s) => ({
            id: s.id,
            prizeLabel: s.prizeLabel,
            tier: s.tier,
            winnerName: s.winnerName,
            winnerEmail: s.winnerEmail,
            createdAt: s.createdAt.toISOString(),
          }))}
        />
      </section>
    </div>
  );
}
