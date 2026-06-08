"use client";

import { useState } from "react";

export default function GiveawayWheelConfigForm({
  initial,
}: {
  initial: {
    enabled: boolean;
    commonWeight: number;
    rareWeight: number;
    jackpotWeight: number;
  };
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/giveaway-wheel/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Save failed");
      }
      setMsg("Saved.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-neutral-200 rounded p-4 space-y-4">
      <h2 className="text-[11px] uppercase tracking-widest font-bold">
        Giveaway wheel settings
      </h2>
      <label className="flex items-center gap-2 text-[12px]">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
        />
        Wheel enabled on /giveawaywheel
      </label>
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ["commonWeight", "Common %"],
            ["rareWeight", "Rare %"],
            ["jackpotWeight", "Jackpot %"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-[10px] uppercase tracking-widest text-neutral-500">
            {label}
            <input
              type="number"
              min={1}
              max={100}
              value={form[key]}
              onChange={(e) =>
                setForm((f) => ({ ...f, [key]: Number(e.target.value) }))
              }
              className="mt-1 w-full border border-neutral-300 px-2 py-2 text-[12px]"
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="bg-black text-white text-[10px] uppercase tracking-widest px-4 py-2 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save settings"}
      </button>
      {msg && <p className="text-[11px] text-neutral-600">{msg}</p>}
    </div>
  );
}
