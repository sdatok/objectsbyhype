import { computeWheelEconomics } from "@/lib/wheel-economics";
import type { WheelConfig, WheelPrize } from "@prisma/client";

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function fmtPct(n: number): string {
  if (n >= 10) return `${n.toFixed(1)}%`;
  if (n >= 1) return `${n.toFixed(2)}%`;
  return `${n.toFixed(3)}%`;
}

export default function WheelEconomicsPanel({
  config,
  prizes,
  spinPrice = 50,
}: {
  config: WheelConfig;
  prizes: WheelPrize[];
  spinPrice?: number;
}) {
  const econ = computeWheelEconomics(config, prizes, spinPrice);

  return (
    <section className="bg-white border border-neutral-200 rounded overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-200">
        <h2 className="text-[11px] uppercase tracking-widest font-bold">
          Profitability estimate
        </h2>
        <p className="text-[11px] text-neutral-500 mt-1">
          Assumes {fmtUsd(spinPrice)} per spin. Physical commons ~$5–15, rares
          ~$15–35, jackpots ~$25–50 (cash/credit/bundles at face value). EV uses
          midpoints unless noted.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-y md:divide-y-0 divide-neutral-200 border-b border-neutral-200">
        {[
          ["Spin price", fmtUsd(econ.spinPrice)],
          ["Expected payout", fmtUsd(econ.expectedPayout)],
          ["Expected profit", fmtUsd(econ.expectedProfit)],
          ["Margin", fmtPct(econ.marginPercent)],
        ].map(([label, value]) => (
          <div key={String(label)} className="px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500">
              {label}
            </p>
            <p className="text-lg font-bold tabular-nums mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:divide-x divide-neutral-200 border-b border-neutral-200">
        {econ.tierEv.map((t) => (
          <div key={t.tier} className="px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500">
              {t.tier} EV
            </p>
            <p className="text-base font-bold tabular-nums mt-0.5">
              {fmtUsd(t.tierEv)}
            </p>
            <p className="text-[11px] text-neutral-500 mt-1">
              {fmtPct(t.tierPercent)} tier · {t.prizeCount} prizes
            </p>
          </div>
        ))}
      </div>

      <div className="max-h-56 overflow-y-auto">
        <table className="w-full text-left text-[12px]">
          <thead className="sticky top-0 bg-neutral-50 border-b border-neutral-200 text-[10px] uppercase tracking-widest text-neutral-500">
            <tr>
              <th className="px-4 py-2">Prize</th>
              <th className="px-4 py-2 text-right">Win %</th>
              <th className="px-4 py-2 text-right">Cost est.</th>
              <th className="px-4 py-2 text-right">EV share</th>
            </tr>
          </thead>
          <tbody>
            {econ.prizes.map((p) => (
              <tr key={`${p.tier}-${p.label}`} className="border-b border-neutral-100">
                <td className="px-4 py-2">
                  <span className="text-[9px] uppercase tracking-widest text-neutral-400 mr-2">
                    {p.tier}
                  </span>
                  {p.label}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {fmtPct(p.winPercent)}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-neutral-600">
                  {p.costLow === p.costHigh
                    ? fmtUsd(p.costMid)
                    : `${fmtUsd(p.costLow)}–${fmtUsd(p.costHigh)}`}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {fmtUsd(p.evContribution)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
