"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewPromoForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    code: "",
    type: "PERCENT" as "PERCENT" | "FIXED",
    value: "",
    expiresAt: "",
    maxRedemptions: "",
    perCustomerLimit: "",
    minSubtotal: "",
  });
  const [error, setError] = useState("");

  async function createPromo(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/promos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code,
        type: form.type,
        value: parseFloat(form.value),
        expiresAt: form.expiresAt || null,
        maxRedemptions: form.maxRedemptions || null,
        perCustomerLimit: form.perCustomerLimit || null,
        minSubtotal: form.minSubtotal || null,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed");
      return;
    }
    setForm({
      code: "",
      type: "PERCENT",
      value: "",
      expiresAt: "",
      maxRedemptions: "",
      perCustomerLimit: "",
      minSubtotal: "",
    });
    router.refresh();
  }

  return (
    <form
      onSubmit={createPromo}
      className="bg-white border border-neutral-200 rounded p-6 mb-10 space-y-4 max-w-xl"
    >
      <h2 className="text-[11px] uppercase tracking-widest font-bold">
        New code
      </h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] uppercase text-neutral-500 mb-1">
            Code
          </label>
          <input
            required
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            className="w-full border border-neutral-300 px-3 py-2 text-[13px] uppercase"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase text-neutral-500 mb-1">
            Type
          </label>
          <select
            value={form.type}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                type: e.target.value as "PERCENT" | "FIXED",
              }))
            }
            className="w-full border border-neutral-300 px-3 py-2 text-[13px] bg-white"
          >
            <option value="PERCENT">Percent off</option>
            <option value="FIXED">Fixed USD off</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-[10px] uppercase text-neutral-500 mb-1">
          Value {form.type === "PERCENT" ? "(%)" : "($)"}
        </label>
        <input
          required
          type="number"
          step="0.01"
          min="0"
          value={form.value}
          onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
          className="w-full border border-neutral-300 px-3 py-2 text-[13px]"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] uppercase text-neutral-500 mb-1">
            Expires (optional)
          </label>
          <input
            type="datetime-local"
            value={form.expiresAt}
            onChange={(e) =>
              setForm((f) => ({ ...f, expiresAt: e.target.value }))
            }
            className="w-full border border-neutral-300 px-3 py-2 text-[13px]"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase text-neutral-500 mb-1">
            Min subtotal ($)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.minSubtotal}
            onChange={(e) =>
              setForm((f) => ({ ...f, minSubtotal: e.target.value }))
            }
            className="w-full border border-neutral-300 px-3 py-2 text-[13px]"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] uppercase text-neutral-500 mb-1">
            Max uses (total)
          </label>
          <input
            type="number"
            min="0"
            value={form.maxRedemptions}
            onChange={(e) =>
              setForm((f) => ({ ...f, maxRedemptions: e.target.value }))
            }
            className="w-full border border-neutral-300 px-3 py-2 text-[13px]"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase text-neutral-500 mb-1">
            Max per customer
          </label>
          <input
            type="number"
            min="0"
            value={form.perCustomerLimit}
            onChange={(e) =>
              setForm((f) => ({ ...f, perCustomerLimit: e.target.value }))
            }
            className="w-full border border-neutral-300 px-3 py-2 text-[13px]"
          />
        </div>
      </div>
      {error && <p className="text-[12px] text-red-600">{error}</p>}
      <button
        type="submit"
        className="bg-black text-white text-[11px] uppercase tracking-widest px-6 py-2.5"
      >
        Create
      </button>
    </form>
  );
}
