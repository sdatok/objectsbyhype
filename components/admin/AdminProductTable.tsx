"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Product } from "@/types";

interface AdminProductTableProps {
  products: (Product & { images: { id: string; url: string; displayOrder: number }[] })[];
}

type StatusMap = Record<string, string>;

export default function AdminProductTable({
  products,
}: AdminProductTableProps) {
  const router = useRouter();
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Optimistic local status per product id
  const [statusMap, setStatusMap] = useState<StatusMap>(() =>
    Object.fromEntries(products.map((p) => [p.id, p.status]))
  );

  // Sync statusMap when server data refreshes (preserves any in-flight optimistic entries)
  useEffect(() => {
    setStatusMap((prev) => {
      const updated = { ...prev };
      for (const p of products) {
        // Only update if we're not currently saving this product
        updated[p.id] = prev[p.id] ?? p.status;
      }
      return updated;
    });
  }, [products]);

  function showError(msg: string) {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 4000);
  }

  async function handleArchive(id: string, name: string) {
    if (!confirm(`Archive "${name}"? It will be hidden from the store but not deleted.`)) return;
    setArchivingId(id);
    setStatusMap((prev) => ({ ...prev, [id]: "ARCHIVED" }));
    const res = await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ARCHIVED" }),
    });
    setArchivingId(null);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setStatusMap((prev) => ({ ...prev, [id]: products.find((p) => p.id === id)?.status ?? "DRAFT" }));
      showError(err.error ?? "Failed to archive. Are you still signed in?");
    }
    router.refresh();
  }

  async function handleStatusChange(id: string, status: string) {
    const previous = statusMap[id];
    setStatusMap((prev) => ({ ...prev, [id]: status }));
    setSavingId(id);
    const res = await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setSavingId(null);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setStatusMap((prev) => ({ ...prev, [id]: previous }));
      showError(err.error ?? "Failed to update status. Are you still signed in?");
      return;
    }
    // Commit confirmed value
    setStatusMap((prev) => ({ ...prev, [id]: status }));
    router.refresh();
  }

  if (products.length === 0) {
    return (
      <div className="bg-white border border-neutral-200 rounded p-16 text-center">
        <p className="text-[12px] text-neutral-400 uppercase tracking-widest mb-4">
          No products yet
        </p>
        <Link
          href="/admin/products/new"
          className="text-[11px] uppercase tracking-widest underline"
        >
          Add your first product
        </Link>
      </div>
    );
  }

  return (
    <div>
      {errorMsg && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-[11px] text-red-600 uppercase tracking-widest">
          {errorMsg}
        </div>
      )}
    <div className="bg-white border border-neutral-200 rounded overflow-x-auto overscroll-x-contain">
      <table className="w-full min-w-[640px]">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-neutral-500 font-medium w-16">
              Image
            </th>
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-neutral-500 font-medium">
              Product
            </th>
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-neutral-500 font-medium hidden md:table-cell">
              Category
            </th>
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-neutral-500 font-medium">
              Price
            </th>
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-neutral-500 font-medium">
              Status
            </th>
            <th className="text-right px-4 py-3 text-[10px] uppercase tracking-widest text-neutral-500 font-medium whitespace-nowrap">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {products.map((product) => {
            const thumb = product.images[0];
            return (
              <tr key={product.id} className="hover:bg-neutral-50 transition-colors">
                {/* Thumbnail */}
                <td className="px-4 py-3">
                  <div className="relative w-12 h-14 bg-neutral-100">
                    {thumb ? (
                      <Image
                        src={thumb.url}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : (
                      <div className="w-full h-full bg-neutral-200" />
                    )}
                  </div>
                </td>

                {/* Name + brand */}
                <td className="px-4 py-3">
                  <p className="text-[12px] font-medium">{product.name}</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    {product.brand}
                  </p>
                </td>

                {/* Category */}
                <td className="px-4 py-3 hidden md:table-cell">
                  <p className="text-[12px] text-neutral-600">
                    {product.category}
                  </p>
                </td>

                {/* Price */}
                <td className="px-4 py-3">
                  <p className="text-[12px] font-medium">
                    ${Number(product.price).toFixed(2)}
                  </p>
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <select
                      value={statusMap[product.id] ?? product.status}
                      disabled={savingId === product.id}
                      onChange={(e) =>
                        handleStatusChange(product.id, e.target.value)
                      }
                      className={`text-[10px] uppercase tracking-widest px-2 py-1 border focus:outline-none disabled:opacity-60 ${
                        (statusMap[product.id] ?? product.status) === "ACTIVE"
                          ? "border-green-300 bg-green-50 text-green-700"
                          : (statusMap[product.id] ?? product.status) === "SOLD"
                          ? "border-neutral-300 bg-neutral-100 text-neutral-500"
                          : (statusMap[product.id] ?? product.status) === "ARCHIVED"
                          ? "border-neutral-300 bg-neutral-200 text-neutral-400"
                          : "border-yellow-300 bg-yellow-50 text-yellow-700"
                      }`}
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="ACTIVE">Active</option>
                      <option value="SOLD">Sold</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                    {savingId === product.id && (
                      <span className="text-[9px] text-neutral-400 uppercase tracking-widest">saving…</span>
                    )}
                  </div>
                </td>

                {/* Actions */}
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-3 shrink-0">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="text-[11px] uppercase tracking-widest hover:underline"
                    >
                      Edit
                    </Link>
                    {(statusMap[product.id] ?? product.status) !== "ARCHIVED" && (
                      <button
                        onClick={() => handleArchive(product.id, product.name)}
                        disabled={archivingId === product.id}
                        className="text-[11px] uppercase tracking-widest text-neutral-400 hover:text-black disabled:opacity-50"
                      >
                        {archivingId === product.id ? "..." : "Archive"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </div>
  );
}
