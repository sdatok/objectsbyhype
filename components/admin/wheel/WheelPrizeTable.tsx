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
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newTier, setNewTier] = useState<PrizeRow["tier"]>("COMMON");
  const [newQty, setNewQty] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const patch = async (id: string, data: Record<string, unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/wheel/prizes/${id}`, {
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
      const res = await fetch("/api/admin/wheel/prizes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          tier: newTier,
          quantity: newQty,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Add failed");
      }
      setNewLabel("");
      setNewQty(1);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add failed");
    } finally {
      setAdding(false);
    }
  };

  const removePrize = async (id: string, label: string) => {
    if (
      !confirm(
        `Remove "${label}" from the wheel? Prizes with spin history are deactivated instead of deleted.`
      )
    ) {
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/wheel/prizes/${id}`, {
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

  return (
    <div className="bg-white border border-neutral-200 rounded overflow-hidden">
      <h2 className="text-[11px] uppercase tracking-widest font-bold px-4 py-3 border-b border-neutral-200">
        Prize pool
      </h2>

      <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50 space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-neutral-500">
          Add prize
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="flex-1 min-w-[140px] text-[10px] uppercase tracking-widest text-neutral-500">
            Name
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="mt-1 w-full border border-neutral-300 px-2 py-2 text-[12px] bg-white"
              placeholder="Prize label"
            />
          </label>
          <label className="text-[10px] uppercase tracking-widest text-neutral-500">
            Tier
            <select
              value={newTier}
              onChange={(e) =>
                setNewTier(e.target.value as PrizeRow["tier"])
              }
              className="mt-1 block border border-neutral-300 px-2 py-2 text-[12px] bg-white"
            >
              <option value="COMMON">Common</option>
              <option value="RARE">Rare</option>
              <option value="JACKPOT">Jackpot</option>
            </select>
          </label>
          <label className="text-[10px] uppercase tracking-widest text-neutral-500">
            Qty
            <input
              type="number"
              min={1}
              value={newQty}
              onChange={(e) => setNewQty(Number(e.target.value))}
              className="mt-1 w-16 border border-neutral-300 px-2 py-2 text-[12px] bg-white"
            />
          </label>
          <button
            type="button"
            onClick={addPrize}
            disabled={adding}
            className="bg-black text-white text-[10px] uppercase tracking-widest px-4 py-2 disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
        {error && (
          <p className="text-[11px] text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>

      <table className="w-full text-left text-[12px]">
        <thead className="border-b border-neutral-200 text-[10px] uppercase tracking-widest text-neutral-500">
          <tr>
            <th className="px-4 py-3">Prize</th>
            <th className="px-4 py-3">Tier</th>
            <th className="px-4 py-3">Left</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {prizes.map((p) => (
            <tr
              key={p.id}
              className={`border-b border-neutral-100 ${!p.active ? "opacity-50" : ""}`}
            >
              <td className="px-4 py-3">{p.label}</td>
              <td className="px-4 py-3">
                <span
                  className={`text-[9px] uppercase tracking-widest px-2 py-0.5 ${TIER_STYLES[p.tier]}`}
                >
                  {p.tier}
                </span>
              </td>
              <td className="px-4 py-3 font-mono tabular-nums">
                <input
                  type="number"
                  min={0}
                  defaultValue={p.quantityRemaining}
                  disabled={busyId === p.id || !p.active}
                  onBlur={(e) => {
                    const n = Math.max(0, Math.floor(Number(e.target.value)));
                    if (n !== p.quantityRemaining) {
                      patch(p.id, { quantityRemaining: n });
                    }
                  }}
                  className="w-14 border border-neutral-200 px-1 py-0.5 text-[12px] bg-white disabled:bg-neutral-50"
                />
                <span className="text-neutral-400 ml-1">/{p.quantityInitial}</span>
              </td>
              <td className="px-4 py-3 text-right space-x-3">
                <button
                  type="button"
                  disabled={busyId === p.id}
                  onClick={() => patch(p.id, { active: !p.active })}
                  className="text-[10px] uppercase tracking-widest text-neutral-600 hover:text-black disabled:opacity-50"
                >
                  {p.active ? "Off" : "On"}
                </button>
                <button
                  type="button"
                  disabled={busyId === p.id}
                  onClick={() => removePrize(p.id, p.label)}
                  className="text-[10px] uppercase tracking-widest text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
