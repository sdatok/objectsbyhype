"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function GiveawayWheelCodeForm() {
  const router = useRouter();
  const [winnerName, setWinnerName] = useState("");
  const [winnerEmail, setWinnerEmail] = useState("");
  const [source, setSource] = useState("Survivor");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    setGeneratedCode(null);
    try {
      const res = await fetch("/api/admin/giveaway-wheel/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerName, winnerEmail, source, notes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Generate failed");
      setGeneratedCode(data.code);
      setWinnerName("");
      setWinnerEmail("");
      setNotes("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border border-neutral-200 rounded p-4 space-y-4">
      <h2 className="text-[11px] uppercase tracking-widest font-bold">
        Generate winner code
      </h2>
      <p className="text-[11px] text-neutral-500">
        Issue a one-time GW code when someone wins a game. Send it to the player so they can spin at /giveawaywheel.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-[10px] uppercase tracking-widest text-neutral-500">
          Winner name
          <input
            value={winnerName}
            onChange={(e) => setWinnerName(e.target.value)}
            className="mt-1 w-full border border-neutral-300 px-2 py-2 text-[12px]"
            placeholder="Display name"
          />
        </label>
        <label className="block text-[10px] uppercase tracking-widest text-neutral-500">
          Email (optional)
          <input
            value={winnerEmail}
            onChange={(e) => setWinnerEmail(e.target.value)}
            className="mt-1 w-full border border-neutral-300 px-2 py-2 text-[12px]"
            placeholder="player@email.com"
          />
        </label>
        <label className="block text-[10px] uppercase tracking-widest text-neutral-500">
          Game / source
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="mt-1 w-full border border-neutral-300 px-2 py-2 text-[12px]"
          >
            <option>Survivor</option>
            <option>Escape Luna</option>
            <option>List-Pack-Shoot</option>
            <option>Other</option>
          </select>
        </label>
        <label className="block text-[10px] uppercase tracking-widest text-neutral-500 sm:col-span-2">
          Notes (optional)
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full border border-neutral-300 px-2 py-2 text-[12px]"
            placeholder="Match ID, placement, etc."
          />
        </label>
      </div>
      {error && (
        <p className="text-[11px] text-red-600" role="alert">
          {error}
        </p>
      )}
      {generatedCode && (
        <p className="text-[12px] font-mono bg-emerald-50 border border-emerald-200 px-3 py-2">
          New code: <strong>{generatedCode}</strong>
        </p>
      )}
      <button
        type="button"
        onClick={generate}
        disabled={busy || winnerName.trim().length < 2}
        className="bg-black text-white text-[10px] uppercase tracking-widest px-4 py-2 disabled:opacity-50"
      >
        {busy ? "Generating…" : "Generate code"}
      </button>
    </div>
  );
}
