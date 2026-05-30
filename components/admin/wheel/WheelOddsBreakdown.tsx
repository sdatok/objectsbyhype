import { computeWheelOdds } from "@/lib/wheel-odds";
import type { WheelConfig, WheelPrize } from "@prisma/client";

const TIER_LABELS = {
  COMMON: "Common",
  RARE: "Rare",
  JACKPOT: "Jackpot",
} as const;

function fmtPct(n: number): string {
  if (n >= 10) return `${n.toFixed(1)}%`;
  if (n >= 1) return `${n.toFixed(2)}%`;
  return `${n.toFixed(3)}%`;
}

export default function WheelOddsBreakdown({
  config,
  prizes,
}: {
  config: WheelConfig;
  prizes: WheelPrize[];
}) {
  const odds = computeWheelOdds(config, prizes);

  return (
    <section className="bg-white border border-neutral-200 rounded overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-200">
        <h2 className="text-[11px] uppercase tracking-widest font-bold">
          Odds breakdown
        </h2>
        <p className="text-[11px] text-neutral-500 mt-1">
          Two-step roll: pick a tier by weight (common {odds.weights.common} · rare{" "}
          {odds.weights.rare} · jackpot {odds.weights.jackpot}), then pick
          uniformly among prizes still in stock in that tier. Tiers with no stock
          left are skipped.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:divide-x divide-neutral-200 border-b border-neutral-200">
        {odds.tiers.map((t) => (
          <div key={t.tier} className="px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500">
              {TIER_LABELS[t.tier]}
            </p>
            <p className="text-lg font-bold tabular-nums mt-0.5">
              {fmtPct(t.tierPercent)}
            </p>
            <p className="text-[11px] text-neutral-500 mt-1">
              {t.prizeCount} prize{t.prizeCount === 1 ? "" : "s"} in pool ·{" "}
              {fmtPct(t.perPrizePercent)} each
            </p>
          </div>
        ))}
      </div>

      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-left text-[12px]">
          <thead className="sticky top-0 bg-neutral-50 border-b border-neutral-200 text-[10px] uppercase tracking-widest text-neutral-500">
            <tr>
              <th className="px-4 py-2">Prize</th>
              <th className="px-4 py-2">Tier</th>
              <th className="px-4 py-2 text-right">Left</th>
              <th className="px-4 py-2 text-right">Win chance</th>
            </tr>
          </thead>
          <tbody>
            {odds.prizes.map((p) => (
              <tr key={p.id} className="border-b border-neutral-100">
                <td className="px-4 py-2">{p.label}</td>
                <td className="px-4 py-2 text-[10px] uppercase tracking-widest text-neutral-500">
                  {p.tier}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {p.quantityRemaining}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums font-medium">
                  {fmtPct(p.overallPercent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
