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
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)} until winner is locked in`;
}

export default function GameConfigForm({ initialConfig }: GameConfigFormProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialConfig.enabled);
  const [prizeTitle, setPrizeTitle] = useState(initialConfig.prizeTitle);
  const [prizeDescription, setPrizeDescription] = useState(
    initialConfig.prizeDescription
  );
  const [windowHours, setWindowHours] = useState(initialConfig.windowHours);
  const [gameSpeed, setGameSpeed] = useState(initialConfig.gameSpeed);
  const [maxMisses, setMaxMisses] = useState(initialConfig.maxMisses);
  const [taskBaseSeconds, setTaskBaseSeconds] = useState(
    initialConfig.taskBaseSeconds
  );
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(
    formatRemaining(new Date(initialConfig.windowEndsAt).getTime())
  );

  useEffect(() => {
    const endsAt = new Date(initialConfig.windowEndsAt).getTime();
    const id = window.setInterval(() => {
      setRemaining(formatRemaining(endsAt));
    }, 1000);
    return () => window.clearInterval(id);
  }, [initialConfig.windowEndsAt]);

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label
            htmlFor="window-hours"
            className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2"
          >
            Window length (hours)
          </label>
          <input
            id="window-hours"
            type="number"
            inputMode="numeric"
            min={1}
            max={168}
            value={windowHours}
            onChange={(e) =>
              setWindowHours(Math.max(1, parseInt(e.target.value, 10) || 1))
            }
            className="w-full border border-neutral-300 px-3 py-3 min-h-[44px] text-base sm:text-[13px] focus:outline-none focus:border-black transition-colors"
          />
          <p className="text-[10px] text-neutral-400 mt-1">
            Applies to the next window. The current window keeps its existing
            length unless you reset it below.
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
      </div>
    </form>
  );
}
