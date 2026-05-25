"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface InitialConfig {
  enabled: boolean;
  prizeTitle: string;
  prizeDescription: string;
  windowHours: number;
  gameSpeed: number;
  maxMisses: number;
  taskBaseSeconds: number;
  windowStartedAt: string;
  windowEndsAt: string;
}

interface GameConfigFormProps {
  initialConfig: InitialConfig;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatRemaining(endsAt: number): string {
  const diff = endsAt - Date.now();
  if (diff <= 0) return "Window expired — next score will start a new one.";
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const stamp = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return days > 0
    ? `${days}d ${stamp} until top 3 are locked in`
    : `${stamp} until top 3 are locked in`;
}

/**
 * `<input type="datetime-local">` wants `YYYY-MM-DDTHH:MM` in local time.
 * Build that from a Date without falling back to ISO/UTC formatting.
 */
function toLocalDatetimeInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${y}-${m}-${day}T${h}:${min}`;
}

const MAX_WINDOW_HOURS = 24 * 30;

export default function GameConfigForm({ initialConfig }: GameConfigFormProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialConfig.enabled);
  const [prizeTitle, setPrizeTitle] = useState(initialConfig.prizeTitle);
  const [prizeDescription, setPrizeDescription] = useState(
    initialConfig.prizeDescription
  );
  const [windowHours, setWindowHours] = useState(initialConfig.windowHours);
  const [endsAtLocal, setEndsAtLocal] = useState(() =>
    toLocalDatetimeInputValue(new Date(initialConfig.windowEndsAt))
  );
  const [gameSpeed, setGameSpeed] = useState(initialConfig.gameSpeed);
  const [maxMisses, setMaxMisses] = useState(initialConfig.maxMisses);
  const [taskBaseSeconds, setTaskBaseSeconds] = useState(
    initialConfig.taskBaseSeconds
  );
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(() =>
    formatRemaining(new Date(initialConfig.windowEndsAt).getTime())
  );

  const startedAtMs = new Date(initialConfig.windowStartedAt).getTime();

  useEffect(() => {
    const endsAt = new Date(initialConfig.windowEndsAt).getTime();
    const id = window.setInterval(() => {
      setRemaining(formatRemaining(endsAt));
    }, 1000);
    return () => window.clearInterval(id);
  }, [initialConfig.windowEndsAt]);

  /** Recompute windowHours from a chosen end-time, preserving the current
   *  windowStartedAt so existing scores stay in the same window. */
  function applyEndsAtToHours(localValue: string) {
    setEndsAtLocal(localValue);
    if (!localValue) return;
    const endMs = new Date(localValue).getTime();
    if (Number.isNaN(endMs)) return;
    const hours = Math.max(
      1,
      Math.min(MAX_WINDOW_HOURS, Math.round((endMs - startedAtMs) / 3600000))
    );
    setWindowHours(hours);
  }

  /** Quick-set: end exactly N days from *now*. Keeps current scores by
   *  leaving windowStartedAt untouched and bumping windowHours. */
  function setEndInDays(days: number) {
    const target = new Date(Date.now() + days * 86400000);
    applyEndsAtToHours(toLocalDatetimeInputValue(target));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/game/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          prizeTitle,
          prizeDescription,
          windowHours,
          gameSpeed,
          maxMisses,
          taskBaseSeconds,
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

  async function resetWindow() {
    if (
      !confirm(
        "Force-start a new giveaway window now? The current window will close and its top scorer will be the winner."
      )
    )
      return;
    setResetting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/game/window", { method: "POST" });
      if (!res.ok) throw new Error("Reset failed");
      setMessage("New window started.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  }

  async function clearLeaderboard() {
    if (
      !confirm(
        "Permanently delete EVERY score in the current window? Previous windows are left intact. This cannot be undone."
      )
    )
      return;
    setClearing(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/game/scores/clear", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Clear failed");
      const data = (await res.json()) as { deleted?: number };
      setMessage(`Cleared ${data.deleted ?? 0} score(s) from the current window.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clear failed");
    } finally {
      setClearing(false);
    }
  }

  return (
    <form onSubmit={save} className="bg-white border border-neutral-200 rounded p-6 space-y-6">
      <div>
        <h2 className="text-[11px] uppercase tracking-widest font-bold">
          Giveaway & game settings
        </h2>
        <p className="text-[11px] text-neutral-500 mt-1">{remaining}</p>
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
            Game enabled
          </span>
          <span className="block text-[10px] text-neutral-500 mt-1 leading-relaxed">
            Off hides the entire section on the home page.
          </span>
        </span>
      </label>

      <div>
        <label
          htmlFor="prize-title"
          className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2"
        >
          Prize title *
        </label>
        <input
          id="prize-title"
          type="text"
          value={prizeTitle}
          onChange={(e) => setPrizeTitle(e.target.value)}
          maxLength={80}
          required
          className="w-full border border-neutral-300 px-3 py-3 min-h-[44px] text-base sm:text-[13px] focus:outline-none focus:border-black transition-colors"
        />
      </div>

      <div>
        <label
          htmlFor="prize-description"
          className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2"
        >
          Prize description
        </label>
        <textarea
          id="prize-description"
          value={prizeDescription}
          onChange={(e) => setPrizeDescription(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Up to 500 chars. Optional context shown under the prize title."
          className="w-full border border-neutral-300 px-3 py-2.5 text-base sm:text-[13px] focus:outline-none focus:border-black transition-colors resize-y"
        />
      </div>

      <div className="border border-neutral-200 rounded p-4 space-y-3 bg-neutral-50">
        <div>
          <label
            htmlFor="ends-at"
            className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2"
          >
            Top 3 announced at
          </label>
          <input
            id="ends-at"
            type="datetime-local"
            value={endsAtLocal}
            onChange={(e) => applyEndsAtToHours(e.target.value)}
            className="w-full border border-neutral-300 px-3 py-3 min-h-[44px] text-base sm:text-[13px] focus:outline-none focus:border-black transition-colors bg-white"
          />
          <p className="text-[10px] text-neutral-400 mt-1">
            Updates the live countdown and keeps every score already submitted
            in the current window. Save to apply.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEndInDays(1)}
            className="border border-neutral-300 bg-white text-[10px] uppercase tracking-widest px-3 py-2 hover:border-black transition-colors"
          >
            +1 day
          </button>
          <button
            type="button"
            onClick={() => setEndInDays(2)}
            className="border border-black bg-black text-white text-[10px] uppercase tracking-widest px-3 py-2 hover:bg-neutral-800 transition-colors"
          >
            +2 days from now
          </button>
          <button
            type="button"
            onClick={() => setEndInDays(7)}
            className="border border-neutral-300 bg-white text-[10px] uppercase tracking-widest px-3 py-2 hover:border-black transition-colors"
          >
            +7 days
          </button>
        </div>
        <p className="text-[10px] text-neutral-400">
          Currently {windowHours}h after window start
          {windowHours >= 24 && ` (${(windowHours / 24).toFixed(1)} days)`}.
        </p>
      </div>

      <div>
        <label
          htmlFor="max-misses"
          className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2"
        >
          Max misses before game over
        </label>
        <input
          id="max-misses"
          type="number"
          inputMode="numeric"
          min={1}
          max={10}
          value={maxMisses}
          onChange={(e) =>
            setMaxMisses(Math.max(1, parseInt(e.target.value, 10) || 1))
          }
          className="w-full border border-neutral-300 px-3 py-3 min-h-[44px] text-base sm:text-[13px] focus:outline-none focus:border-black transition-colors"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label
            htmlFor="game-speed"
            className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2"
          >
            Game speed: {gameSpeed.toFixed(2)}×
          </label>
          <input
            id="game-speed"
            type="range"
            min={0.25}
            max={4}
            step={0.05}
            value={gameSpeed}
            onChange={(e) => setGameSpeed(parseFloat(e.target.value))}
            className="w-full accent-black"
          />
          <p className="text-[10px] text-neutral-400 mt-1">
            1.0 = default. Higher = tasks spawn faster.
          </p>
        </div>
        <div>
          <label
            htmlFor="task-seconds"
            className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2"
          >
            Base task duration (seconds)
          </label>
          <input
            id="task-seconds"
            type="number"
            inputMode="numeric"
            min={2}
            max={30}
            value={taskBaseSeconds}
            onChange={(e) =>
              setTaskBaseSeconds(
                Math.max(2, parseInt(e.target.value, 10) || 2)
              )
            }
            className="w-full border border-neutral-300 px-3 py-3 min-h-[44px] text-base sm:text-[13px] focus:outline-none focus:border-black transition-colors"
          />
        </div>
      </div>

      {error && <p className="text-[12px] text-red-600">{error}</p>}
      {message && <p className="text-[12px] text-green-700">{message}</p>}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-black text-white text-[11px] uppercase tracking-widest px-6 py-3 min-h-[44px] hover:bg-neutral-800 transition-colors disabled:bg-neutral-400"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        <button
          type="button"
          onClick={resetWindow}
          disabled={resetting}
          className="border border-black text-[11px] uppercase tracking-widest px-6 py-3 min-h-[44px] hover:bg-black hover:text-white transition-colors disabled:opacity-50"
        >
          {resetting ? "Resetting…" : "Force-start new window"}
        </button>
        <button
          type="button"
          onClick={clearLeaderboard}
          disabled={clearing}
          className="border border-rose-600 text-rose-700 text-[11px] uppercase tracking-widest px-6 py-3 min-h-[44px] hover:bg-rose-600 hover:text-white transition-colors disabled:opacity-50"
        >
          {clearing ? "Clearing…" : "Clear current leaderboard"}
        </button>
      </div>
    </form>
  );
}
