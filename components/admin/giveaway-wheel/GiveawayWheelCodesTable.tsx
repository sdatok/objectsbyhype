"use client";

export interface GiveawayCodeRow {
  id: string;
  code: string;
  winnerName: string;
  winnerEmail: string;
  source: string;
  notes: string | null;
  usedAt: string | null;
  createdAt: string;
  prizeLabel: string | null;
}

export default function GiveawayWheelCodesTable({ codes }: { codes: GiveawayCodeRow[] }) {
  if (codes.length === 0) {
    return <p className="text-[12px] text-neutral-400 italic">No codes yet.</p>;
  }

  return (
    <div className="bg-white border border-neutral-200 rounded overflow-hidden">
      <table className="w-full text-left text-[12px]">
        <thead className="border-b border-neutral-200 text-[10px] uppercase tracking-widest text-neutral-500">
          <tr>
            <th className="px-4 py-3">Winner</th>
            <th className="px-4 py-3">Code</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Prize</th>
          </tr>
        </thead>
        <tbody>
          {codes.map((c) => (
            <tr key={c.id} className="border-b border-neutral-100">
              <td className="px-4 py-3">
                <span className="font-medium">{c.winnerName}</span>
                {c.winnerEmail && (
                  <span className="text-neutral-500 text-[11px] ml-2">{c.winnerEmail}</span>
                )}
              </td>
              <td className="px-4 py-3 font-mono text-[11px]">{c.code}</td>
              <td className="px-4 py-3">{c.source || "—"}</td>
              <td className="px-4 py-3">
                {c.usedAt ? (
                  <span className="text-emerald-700">Used</span>
                ) : (
                  <span className="text-amber-700">Unused</span>
                )}
              </td>
              <td className="px-4 py-3">{c.prizeLabel ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
