"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface ProMemberRow {
  id: string;
  name: string;
  email: string;
  monthlyPrice: number;
  active: boolean;
  notes: string | null;
  code: string | null;
  codeUsed: boolean;
}

export default function ProMemberTable({
  members,
  monthKey,
}: {
  members: ProMemberRow[];
  monthKey: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const generateCode = async (proMemberId: string) => {
    setBusyId(proMemberId);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/wheel/codes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proMemberId, monthKey }),
      });
      if (!res.ok) throw new Error("Generate failed");
      router.refresh();
    } catch {
      setMsg("Code generation failed.");
    } finally {
      setBusyId(null);
    }
  };

  const bulkGenerate = async () => {
    setBulkBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/wheel/codes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bulk: true, monthKey }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Bulk failed");
      setMsg(`Generated ${j.count ?? 0} new codes for ${monthKey}.`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Bulk failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setMsg(`Copied ${code}`);
    } catch {
      setMsg("Copy failed");
    }
  };

  const deactivate = async (id: string) => {
    if (!confirm("Deactivate this pro member?")) return;
    await fetch(`/api/admin/wheel/pro-members/${id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className="bg-white border border-neutral-200 rounded overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-neutral-200">
        <h2 className="text-[11px] uppercase tracking-widest font-bold">
          Pro members ({members.filter((m) => m.active).length} active)
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={bulkGenerate}
            disabled={bulkBusy}
            className="border border-neutral-300 text-[10px] uppercase tracking-widest px-3 py-1.5 hover:border-black disabled:opacity-50"
          >
            {bulkBusy ? "Generating…" : `Generate all codes · ${monthKey}`}
          </button>
          <a
            href={`/api/admin/wheel/codes/generate?month=${monthKey}`}
            className="border border-neutral-300 text-[10px] uppercase tracking-widest px-3 py-1.5 hover:border-black"
          >
            Export CSV
          </a>
        </div>
      </div>
      {msg && (
        <p className="px-4 py-2 text-[11px] text-neutral-600 border-b border-neutral-100">
          {msg}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead className="border-b border-neutral-200 text-[10px] uppercase tracking-widest text-neutral-500">
            <tr>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">$/mo</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-neutral-100">
                <td className="px-4 py-3">
                  <p className={`font-medium ${!m.active ? "text-neutral-400 line-through" : ""}`}>
                    {m.name}
                  </p>
                  <p className="text-[11px] text-neutral-500">{m.email}</p>
                </td>
                <td className="px-4 py-3 font-mono tabular-nums">
                  ${m.monthlyPrice.toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  {m.code ? (
                    <span className="font-mono text-[11px]">
                      {m.code}{" "}
                      {m.codeUsed && (
                        <span className="text-emerald-600 uppercase text-[9px]">
                          used
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-neutral-400 italic text-[11px]">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                  {m.code ? (
                    <button
                      type="button"
                      onClick={() => copyCode(m.code!)}
                      className="text-[10px] uppercase tracking-widest text-neutral-600 hover:text-black"
                    >
                      Copy
                    </button>
                  ) : m.active ? (
                    <button
                      type="button"
                      disabled={busyId === m.id}
                      onClick={() => generateCode(m.id)}
                      className="text-[10px] uppercase tracking-widest text-fuchsia-700 hover:text-fuchsia-900 disabled:opacity-50"
                    >
                      {busyId === m.id ? "…" : "Gen code"}
                    </button>
                  ) : null}
                  {m.active && (
                    <button
                      type="button"
                      onClick={() => deactivate(m.id)}
                      className="text-[10px] uppercase tracking-widest text-rose-600 hover:text-rose-800"
                    >
                      Deactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {members.length === 0 && (
          <p className="p-8 text-center text-[12px] text-neutral-400">
            No pro members yet.
          </p>
        )}
      </div>
    </div>
  );
}
