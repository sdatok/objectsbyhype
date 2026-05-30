"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface PrizeRow {
  id: string;
  label: string;
  tier: "COMMON" | "RARE" | "JACKPOT";
  quantityRemaining: number;
  quantityInitial: number;
  active: boolean;
}

const TIER_STYLES = {
  COMMON: "text-neutral-600 bg-neutral-100",
  RARE: "text-violet-700 bg-violet-100",
  JACKPOT: "text-amber-800 bg-amber-100",
};

export default function WheelPrizeTable({ prizes }: { prizes: PrizeRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const patch = async (id: string, data: Record<string, unknown>) => {
    setBusyId(id);
    try {
      await fetch(`/api/admin/wheel/prizes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white border border-neutral-200 rounded overflow-hidden">
      <h2 className="text-[11px] uppercase tracking-widest font-bold px-4 py-3 border-b border-neutral-200">
        Prize pool
      </h2>
      <table className="w-full text-left text-[12px]">
        <thead className="border-b border-neutral-200 text-[10px] uppercase tracking-widest text-neutral-500">
          <tr>
            <th className="px-4 py-3">Prize</th>
            <th className="px-4 py-3">Tier</th>
            <th className="px-4 py-3">Left</th>
            <th className="px-4 py-3 text-right">Active</th>
          </tr>
        </thead>
        <tbody>
          {prizes.map((p) => (
            <tr key={p.id} className="border-b border-neutral-100">
              <td className="px-4 py-3">{p.label}</td>
              <td className="px-4 py-3">
                <span
                  className={`text-[9px] uppercase tracking-widest px-2 py-0.5 ${TIER_STYLES[p.tier]}`}
                >
                  {p.tier}
                </span>
              </td>
              <td className="px-4 py-3 font-mono tabular-nums">
                {p.quantityRemaining}/{p.quantityInitial}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  disabled={busyId === p.id}
                  onClick={() => patch(p.id, { active: !p.active })}
                  className="text-[10px] uppercase tracking-widest text-neutral-600 hover:text-black disabled:opacity-50"
                >
                  {p.active ? "On" : "Off"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
