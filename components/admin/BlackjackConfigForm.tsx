"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BLACKJACK_DEFAULT_ROUND_SECONDS,
  BLACKJACK_WHEEL_WINNERS,
} from "@/lib/blackjack-types";

interface InitialConfig {
  enabled: boolean;
  prizeTitle: string;
  prizeDescription: string;
  roundSeconds: number;
  roundEndsAt: string | null;
  entryCount: number;
}

interface BlackjackConfigFormProps {
  initialConfig: InitialConfig;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${pad(m)}:${pad(s)}`;
}

export default function BlackjackConfigForm({
  initialConfig,
}: BlackjackConfigFormProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialConfig.enabled);
  const [prizeTitle, setPrizeTitle] = useState(initialConfig.prizeTitle);
  const [prizeDescription, setPrizeDescription] = useState(
    initialConfig.prizeDescription
  );
  const [roundSeconds, setRoundSeconds] = useState(initialConfig.roundSeconds);
  const [saving, setSaving] = useState(false);
  const [startingRound, setStartingRound] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(() => {
    if (!initialConfig.roundEndsAt) return "—";
    const diff = Math.floor(
      (new Date(initialConfig.roundEndsAt).getTime() - Date.now()) / 1000
    );
    return formatCountdown(diff);
  });

  useEffect(() => {
    if (!initialConfig.roundEndsAt) return;
    const endsAt = new Date(initialConfig.roundEndsAt).getTime();
    const tick = () => {
      const diff = Math.floor((endsAt - Date.now()) / 1000);
      setRemaining(formatCountdown(diff));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [initialConfig.roundEndsAt]);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/blackjack/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          prizeTitle,
          prizeDescription,
          roundSeconds,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setMessage("Saved.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function forceRound() {
    setStartingRound(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/blackjack/config", { method: "POST" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not start round");
      setMessage("New round started.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start round");
    } finally {
      setStartingRound(false);
    }
  }

  return (
    <div className="bg-white border border-neutral-200 rounded p-5 space-y-4">
      <h2 className="text-[11px] uppercase tracking-widest font-bold">
        Settings
      </h2>

      <label className="flex items-center gap-2 text-[12px]">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Enabled at <code>/blackjack</code>
      </label>

      <div>
        <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-1">
          Prize title
        </label>
        <input
          className="w-full border border-neutral-200 px-3 py-2 text-[12px]"
          value={prizeTitle}
          onChange={(e) => setPrizeTitle(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-1">
          Description
        </label>
        <textarea
          className="w-full border border-neutral-200 px-3 py-2 text-[12px] min-h-[72px]"
          value={prizeDescription}
          onChange={(e) => setPrizeDescription(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-1">
          Round length (seconds)
        </label>
        <input
          type="number"
          min={60}
          max={3600}
          className="w-full border border-neutral-200 px-3 py-2 text-[12px]"
          value={roundSeconds}
          onChange={(e) =>
            setRoundSeconds(parseInt(e.target.value, 10) || BLACKJACK_DEFAULT_ROUND_SECONDS)
          }
        />
        <p className="text-[10px] text-neutral-400 mt-1">
          Default 180 = one hand every 3 minutes. Top {BLACKJACK_WHEEL_WINNERS}{" "}
          hands win a giveaway wheel spin.
        </p>
      </div>

      {initialConfig.roundEndsAt && (
        <p className="text-[11px] text-neutral-600">
          Current round: <span className="font-mono">{remaining}</span> left ·{" "}
          {initialConfig.entryCount} hands played
        </p>
      )}

      {message && <p className="text-[11px] text-emerald-600">{message}</p>}
      {error && <p className="text-[11px] text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-black text-white text-[10px] uppercase tracking-widest disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={forceRound}
          disabled={startingRound}
          className="px-4 py-2 border border-neutral-300 text-[10px] uppercase tracking-widest disabled:opacity-50"
        >
          {startingRound ? "Starting…" : "Force new round"}
        </button>
      </div>
    </div>
  );
}
