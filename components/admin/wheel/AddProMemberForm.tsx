"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AddProMemberForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/wheel/pro-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          monthlyPrice: Number(monthlyPrice),
          notes: notes || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Failed");
      setName("");
      setEmail("");
      setMonthlyPrice("");
      setNotes("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white border border-neutral-200 rounded p-4 space-y-3">
      <h2 className="text-[11px] uppercase tracking-widest font-bold">
        Add pro member
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          required
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border border-neutral-300 px-3 py-2 text-[12px]"
        />
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border border-neutral-300 px-3 py-2 text-[12px]"
        />
        <input
          required
          type="number"
          min={0}
          step="0.01"
          placeholder="Monthly price ($)"
          value={monthlyPrice}
          onChange={(e) => setMonthlyPrice(e.target.value)}
          className="border border-neutral-300 px-3 py-2 text-[12px]"
        />
        <input
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="border border-neutral-300 px-3 py-2 text-[12px]"
        />
      </div>
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="bg-black text-white text-[10px] uppercase tracking-widest px-4 py-2 disabled:opacity-50"
      >
        {busy ? "Adding…" : "Add member"}
      </button>
    </form>
  );
}
