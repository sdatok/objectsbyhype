"use client";

import { useRouter } from "next/navigation";

interface Promo {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  active: boolean;
}

export default function PromoTableActions({ promos }: { promos: Promo[] }) {
  const router = useRouter();

  async function toggleActive(p: Promo) {
    await fetch(`/api/admin/promos/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this promo code?")) return;
    await fetch(`/api/admin/promos/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <tbody className="divide-y divide-neutral-100">
      {promos.map((p) => (
        <tr key={p.id}>
          <td className="px-4 py-3 font-mono">{p.code}</td>
          <td className="px-4 py-3">{p.type}</td>
          <td className="px-4 py-3">
            {p.type === "PERCENT"
              ? `${Number(p.value).toFixed(0)}%`
              : `$${Number(p.value).toFixed(2)}`}
          </td>
          <td className="px-4 py-3">
            <button
              type="button"
              onClick={() => toggleActive(p)}
              className={p.active ? "text-green-700" : "text-neutral-400"}
            >
              {p.active ? "On" : "Off"}
            </button>
          </td>
          <td className="px-4 py-3 text-right">
            <button
              type="button"
              onClick={() => remove(p.id)}
              className="text-neutral-400 hover:text-red-600 uppercase text-[10px] tracking-widest"
            >
              Delete
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  );
}
