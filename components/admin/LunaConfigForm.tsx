"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  clampMatchSeconds,
  LUNA_MAX_MATCH_SECONDS,
  LUNA_MIN_MATCH_SECONDS,
} from "@/lib/luna-config";

interface InitialConfig {
  enabled: boolean;
  prizeTitle: string;
  prizeDescription: string;
  matchSeconds: number;
}

interface LunaConfigFormProps {
  initialConfig: InitialConfig;
}

export default function LunaConfigForm({ initialConfig }: LunaConfigFormProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialConfig.enabled);
  const [prizeTitle, setPrizeTitle] = useState(initialConfig.prizeTitle);
  const [prizeDescription, setPrizeDescription] = useState(
    initialConfig.prizeDescription
  );
  const [matchSecondsInput, setMatchSecondsInput] = useState(
    String(initialConfig.matchSeconds)
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const matchSeconds = clampMatchSeconds(
        matchSecondsInput,
        initialConfig.matchSeconds
      );
      setMatchSecondsInput(String(matchSeconds));
      const res = await fetch("/api/admin/luna/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          prizeTitle,
          prizeDescription,
          matchSeconds,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Save failed");
      }
      setMessage("Saved");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="bg-white border border-neutral-200 rounded p-6 space-y-6"
    >
      <div>
        <h2 className="text-[11px] uppercase tracking-widest font-bold">
          Escape Luna config
        </h2>
        <p className="text-[11px] text-neutral-500 mt-1">
          Applies to the next match you open. Doesn&apos;t affect a match
          already in progress.
        </p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer rounded border border-neutral-200 px-4 py-3.5 hover:border-neutral-300 transition-colors">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 text-black focus:ring-1 focus:ring-black"
        />
        <span>
          <span className="block text-[11px] uppercase tracking-widest font-medium text-black">
            Escape Luna enabled
          </span>
          <span className="block text-[10px] text-neutral-500 mt-1 leading-relaxed">
            Off shows an offline screen on <code>/escape-luna</code> and blocks
            lobby joins.
          </span>
        </span>
      </label>

      <div>
        <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
          Prize title *
        </label>
        <input
          type="text"
          value={prizeTitle}
          onChange={(e) => setPrizeTitle(e.target.value)}
          maxLength={80}
          required
          className="w-full border border-neutral-300 px-3 py-3 min-h-[44px] text-base sm:text-[13px] focus:outline-none focus:border-black transition-colors"
        />
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
          Prize description
        </label>
        <textarea
          value={prizeDescription}
          onChange={(e) => setPrizeDescription(e.target.value)}
          rows={3}
          maxLength={500}
          className="w-full border border-neutral-300 px-3 py-2.5 text-base sm:text-[13px] focus:outline-none focus:border-black transition-colors resize-y"
        />
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
          Match length (seconds)
        </label>
        <input
          type="number"
          min={LUNA_MIN_MATCH_SECONDS}
          max={LUNA_MAX_MATCH_SECONDS}
          step={1}
          value={matchSecondsInput}
          onChange={(e) => setMatchSecondsInput(e.target.value)}
          onBlur={() =>
            setMatchSecondsInput(
              String(
                clampMatchSeconds(matchSecondsInput, initialConfig.matchSeconds)
              )
            )
          }
          className="w-full border border-neutral-300 px-3 py-3 min-h-[44px] text-base sm:text-[13px] focus:outline-none focus:border-black transition-colors"
        />
        <p className="text-[10px] text-neutral-400 mt-1">
          Default round length ({LUNA_MIN_MATCH_SECONDS}–
          {LUNA_MAX_MATCH_SECONDS}s). Used when you open a new match.
        </p>
      </div>

      {error && <p className="text-[12px] text-red-600">{error}</p>}
      {message && <p className="text-[12px] text-green-700">{message}</p>}

      <button
        type="submit"
        disabled={saving}
        className="bg-black text-white text-[11px] uppercase tracking-widest px-6 py-3 min-h-[44px] hover:bg-neutral-800 transition-colors disabled:bg-neutral-400"
      >
        {saving ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
