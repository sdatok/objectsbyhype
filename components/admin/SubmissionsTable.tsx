"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

type SubmissionStatus =
  | "PENDING"
  | "REVIEWING"
  | "ACCEPTED_BUY"
  | "ACCEPTED_CONSIGN"
  | "DECLINED";

interface Submission {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  itemName: string;
  brand: string;
  description: string;
  askingPrice: number | null;
  condition: string;
  imageUrls: string[];
  status: SubmissionStatus;
  adminNotes: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  PENDING: "Pending",
  REVIEWING: "Reviewing",
  ACCEPTED_BUY: "Buy",
  ACCEPTED_CONSIGN: "Consign",
  DECLINED: "Declined",
};

const STATUS_STYLES: Record<SubmissionStatus, string> = {
  PENDING: "bg-yellow-50 border-yellow-300 text-yellow-700",
  REVIEWING: "bg-blue-50 border-blue-300 text-blue-700",
  ACCEPTED_BUY: "bg-green-50 border-green-300 text-green-700",
  ACCEPTED_CONSIGN: "bg-emerald-50 border-emerald-300 text-emerald-700",
  DECLINED: "bg-neutral-100 border-neutral-300 text-neutral-500",
};

export default function SubmissionsTable({
  submissions,
}: {
  submissions: Submission[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  async function updateStatus(id: string, status: SubmissionStatus) {
    setSaving(id);
    await fetch(`/api/submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setSaving(null);
    router.refresh();
  }

  async function saveNotes(id: string) {
    setSaving(id);
    await fetch(`/api/submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminNotes: notes[id] ?? "" }),
    });
    setSaving(null);
    router.refresh();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete submission from ${name}?`)) return;
    await fetch(`/api/submissions/${id}`, { method: "DELETE" });
    router.refresh();
  }

  if (submissions.length === 0) {
    return (
      <div className="bg-white border border-neutral-200 rounded p-16 text-center">
        <p className="text-[12px] text-neutral-400 uppercase tracking-widest">
          No submissions yet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {submissions.map((sub) => {
        const isOpen = expanded === sub.id;
        return (
          <div
            key={sub.id}
            className="bg-white border border-neutral-200 rounded overflow-hidden"
          >
            {/* Summary row */}
            <div
              className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-neutral-50 transition-colors"
              onClick={() => setExpanded(isOpen ? null : sub.id)}
            >
              {/* Thumbnail */}
              <div className="relative w-12 h-14 bg-neutral-100 flex-shrink-0">
                {sub.imageUrls[0] ? (
                  <Image
                    src={sub.imageUrls[0]}
                    alt={sub.itemName}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                ) : (
                  <div className="w-full h-full bg-neutral-200" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-3 flex-wrap">
                  <p className="text-[13px] font-semibold truncate">
                    {sub.itemName}
                  </p>
                  <span
                    className={`text-[9px] uppercase tracking-widest px-2 py-0.5 border font-medium shrink-0 ${STATUS_STYLES[sub.status]}`}
                  >
                    {STATUS_LABELS[sub.status]}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  {sub.brand} · {sub.condition}
                  {sub.askingPrice != null && ` · $${sub.askingPrice.toFixed(2)}`}
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {sub.name} · {sub.email}
                  {sub.phone && ` · ${sub.phone}`}
                </p>
              </div>

              {/* Date + toggle */}
              <div className="text-right shrink-0">
                <p className="text-[10px] text-neutral-400">
                  {new Date(sub.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <p className="text-[11px] text-neutral-400 mt-1">
                  {isOpen ? "▲" : "▼"}
                </p>
              </div>
            </div>

            {/* Expanded details */}
            {isOpen && (
              <div className="border-t border-neutral-200 px-5 py-5 space-y-5">
                {/* Images */}
                {sub.imageUrls.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-3">
                      Photos ({sub.imageUrls.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {sub.imageUrls.map((url, idx) => (
                        <a
                          key={url + idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative w-24 h-28 bg-neutral-100 block hover:opacity-80 transition-opacity"
                        >
                          <Image
                            src={url}
                            alt={`${sub.itemName} ${idx + 1}`}
                            fill
                            className="object-cover"
                            sizes="96px"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2">
                    Description
                  </p>
                  <p className="text-[13px] text-neutral-600 leading-relaxed">
                    {sub.description}
                  </p>
                </div>

                {/* Status actions */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-3">
                    Decision
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        "PENDING",
                        "REVIEWING",
                        "ACCEPTED_BUY",
                        "ACCEPTED_CONSIGN",
                        "DECLINED",
                      ] as SubmissionStatus[]
                    ).map((s) => (
                      <button
                        key={s}
                        onClick={() => updateStatus(sub.id, s)}
                        disabled={saving === sub.id}
                        className={`px-3 py-2 text-[10px] uppercase tracking-widest border transition-colors ${
                          sub.status === s
                            ? "bg-black text-white border-black"
                            : "border-neutral-300 hover:border-black"
                        }`}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Admin notes */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2">
                    Internal Notes
                  </p>
                  <textarea
                    rows={3}
                    defaultValue={sub.adminNotes ?? ""}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [sub.id]: e.target.value }))
                    }
                    placeholder="Offer amount, condition notes, follow-up needed..."
                    className="w-full border border-neutral-300 px-3 py-2.5 text-[12px] focus:outline-none focus:border-black transition-colors resize-none"
                  />
                  <div className="flex items-center gap-4 mt-2">
                    <button
                      onClick={() => saveNotes(sub.id)}
                      disabled={saving === sub.id}
                      className="text-[11px] uppercase tracking-widest bg-black text-white px-4 py-2 hover:bg-neutral-800 transition-colors disabled:bg-neutral-400"
                    >
                      {saving === sub.id ? "Saving..." : "Save Notes"}
                    </button>
                    <button
                      onClick={() => handleDelete(sub.id, sub.name)}
                      className="text-[11px] uppercase tracking-widest text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
