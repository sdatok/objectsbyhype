"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface GiveawaySpinRow {
  id: string;
  prizeLabel: string;
  tier: string;
  winnerName: string;
  winnerEmail: string;
  createdAt: string;
}

export default function GiveawayWheelRecentSpinsTable({ spins }: { spins: GiveawaySpinRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = async (id: string) => {
    if (
      !confirm(
        "Remove this spin? Prize goes back in stock and the code becomes usable again."
      )
    ) {
      return;
    }

    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/giveaway-wheel/spins/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Remove failed");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setBusyId(null);
    }
  };

  if (spins.length === 0) {
    return <p className="text-[12px] text-neutral-400 italic">No spins yet.</p>;
  }

  return (
    <div>
      {error && (
        <p className="text-[11px] text-red-600 mb-2" role="alert">
          {error}
        </p>
      )}
      <div className="bg-white border border-neutral-200 rounded overflow-hidden">
        <table className="w-full text-left text-[12px]">
          <thead className="border-b border-neutral-200 text-[10px] uppercase tracking-widest text-neutral-500">
            <tr>
              <th className="px-4 py-3">Winner</th>
              <th className="px-4 py-3">Prize</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3 text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {spins.map((s) => (
              <tr key={s.id} className="border-b border-neutral-100">
                <td className="px-4 py-3">
                  <span className="font-medium">{s.winnerName}</span>
                  {s.winnerEmail && (
                    <span className="text-neutral-500 text-[11px] ml-2">
                      {s.winnerEmail}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium">{s.prizeLabel}</td>
                <td className="px-4 py-3 text-[10px] uppercase tracking-widest">
                  {s.tier}
                </td>
                <td className="px-4 py-3 text-[11px] text-neutral-500">
                  {new Date(s.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    disabled={busyId === s.id}
                    onClick={() => remove(s.id)}
                    className="text-[10px] uppercase tracking-widest text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    {busyId === s.id ? "…" : "Remove"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
