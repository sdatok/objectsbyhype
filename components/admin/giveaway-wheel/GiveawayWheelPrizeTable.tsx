"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface GiveawayPrizeRow {
  id: string;
  label: string;
  tier: "COMMON" | "RARE" | "JACKPOT";
  quantityRemaining: number;
  quantityInitial: number;
  active: boolean;
}

const TIER_STYLES = {
  COMMON: "text-emerald-700 bg-emerald-100",
  RARE: "text-sky-700 bg-sky-100",
  JACKPOT: "text-amber-800 bg-amber-100",
};

export default function GiveawayWheelPrizeTable({ prizes }: { prizes: GiveawayPrizeRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newTier, setNewTier] = useState<GiveawayPrizeRow["tier"]>("COMMON");
  const [newQty, setNewQty] = useState(10);
  const [error, setError] = useState<string | null>(null);

  const patch = async (id: string, data: Record<string, unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/giveaway-wheel/prizes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Update failed");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  const addPrize = async () => {
    const label = newLabel.trim();
    if (!label) {
      setError("Prize name is required.");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/giveaway-wheel/prizes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, tier: newTier, quantity: newQty }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Add failed");
      }
      setNewLabel("");
      setNewQty(10);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add failed");
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-[11px] uppercase tracking-widest font-bold">Prize pool</h2>
      {error && (
        <p className="text-[11px] text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="bg-white border border-neutral-200 rounded overflow-hidden">
        <table className="w-full text-left text-[12px]">
          <thead className="border-b border-neutral-200 text-[10px] uppercase tracking-widest text-neutral-500">
            <tr>
              <th className="px-4 py-3">Prize</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3 text-right">Adjust</th>
            </tr>
          </thead>
          <tbody>
            {prizes.map((p) => (
              <tr key={p.id} className="border-b border-neutral-100">
                <td className="px-4 py-3 font-medium">{p.label}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded ${TIER_STYLES[p.tier]}`}>
                    {p.tier}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {p.quantityRemaining} / {p.quantityInitial}
                </td>
                <td className="px-4 py-3">{p.active ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() =>
                      patch(p.id, { quantityRemaining: p.quantityRemaining + 1 })
                    }
                    className="text-[10px] uppercase tracking-widest disabled:opacity-50"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    disabled={busyId === p.id || !p.active}
                    onClick={() => patch(p.id, { active: false, quantityRemaining: 0 })}
                    className="text-[10px] uppercase tracking-widest text-red-600 disabled:opacity-50"
                  >
                    Deactivate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-neutral-50 border border-neutral-200 rounded p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
        <label className="block text-[10px] uppercase tracking-widest text-neutral-500 sm:col-span-2">
          New prize
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="mt-1 w-full border border-neutral-300 px-2 py-2 text-[12px]"
          />
        </label>
        <label className="block text-[10px] uppercase tracking-widest text-neutral-500">
          Tier
          <select
            value={newTier}
            onChange={(e) => setNewTier(e.target.value as GiveawayPrizeRow["tier"])}
            className="mt-1 w-full border border-neutral-300 px-2 py-2 text-[12px]"
          >
            <option value="COMMON">Common</option>
            <option value="RARE">Rare</option>
            <option value="JACKPOT">Jackpot</option>
          </select>
        </label>
        <label className="block text-[10px] uppercase tracking-widest text-neutral-500">
          Qty
          <input
            type="number"
            min={1}
            value={newQty}
            onChange={(e) => setNewQty(Number(e.target.value))}
            className="mt-1 w-full border border-neutral-300 px-2 py-2 text-[12px]"
          />
        </label>
        <button
          type="button"
          onClick={addPrize}
          disabled={adding}
          className="sm:col-span-4 bg-black text-white text-[10px] uppercase tracking-widest px-4 py-2 disabled:opacity-50"
        >
          {adding ? "Adding…" : "Add prize"}
        </button>
      </div>
    </section>
  );
}
