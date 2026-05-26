"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface InitialControls {
  hasActive: boolean;
  currentMatchId: string | null;
  currentStatus: "WAITING" | "PLAYING" | "ENDED" | null;
  defaultMatchSeconds: number;
}

interface SurvivorState {
  enabled: boolean;
  prizeTitle: string;
  currentMatch: {
    id: string;
    status: "WAITING" | "PLAYING" | "ENDED";
    participantCount: number;
  } | null;
}

interface SurvivorMatchControlsProps {
  initial: InitialControls;
}

export default function SurvivorMatchControls({
  initial,
}: SurvivorMatchControlsProps) {
  const router = useRouter();
  const [lobbySeconds, setLobbySeconds] = useState(60);
  const [matchSeconds, setMatchSeconds] = useState(initial.defaultMatchSeconds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<SurvivorState | null>(null);

  // Poll every 3s while the page is open so admin sees live participant count.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await fetch("/api/survivor/state", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as SurvivorState;
        if (!cancelled) setState(next);
      } catch {
        /* ignore */
      }
    };
    refresh();
    const id = window.setInterval(refresh, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const liveStatus =
    state?.currentMatch?.status ?? initial.currentStatus ?? null;
  const liveCount = state?.currentMatch?.participantCount ?? 0;
  const liveMatchId = state?.currentMatch?.id ?? initial.currentMatchId ?? null;
  const hasActive =
    !!liveMatchId && (liveStatus === "WAITING" || liveStatus === "PLAYING");

  async function startMatch() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/survivor/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchSeconds, lobbySeconds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Start failed");
      setMessage(`Match opened (${data.matchId}). Lobby is live.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Start failed");
    } finally {
      setBusy(false);
    }
  }

  async function endMatch() {
    if (!confirm("End the current match now? Results will be locked in.")) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/survivor/end", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "End failed");
      setMessage("Match ended.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "End failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border border-neutral-200 rounded p-6 space-y-5">
      <div>
        <h2 className="text-[11px] uppercase tracking-widest font-bold">
          Match controls
        </h2>
        <p className="text-[11px] text-neutral-500 mt-1">
          Open a lobby, players join via <code>/survivor</code>, then the match
          auto-starts when the countdown ends.
        </p>
      </div>

      <div className="border border-neutral-200 rounded p-4 bg-neutral-50">
        <p className="text-[10px] uppercase tracking-widest text-neutral-500">
          Current match
        </p>
        {hasActive ? (
          <div className="mt-2 space-y-1">
            <p className="text-[13px] font-medium">
              Status: <span className="font-mono">{liveStatus}</span>
            </p>
            <p className="text-[11px] text-neutral-500">
              Match id: <span className="font-mono">{liveMatchId}</span>
            </p>
            <p className="text-[11px] text-neutral-500">
              Lobby joins so far: <strong>{liveCount}</strong>
            </p>
          </div>
        ) : (
          <p className="text-[12px] text-neutral-400 italic mt-1">
            No active match.
          </p>
        )}
      </div>

      {!hasActive && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
              Lobby seconds (countdown)
            </label>
            <input
              type="number"
              min={5}
              max={600}
              value={lobbySeconds}
              onChange={(e) =>
                setLobbySeconds(
                  Math.max(
                    5,
                    Math.min(600, parseInt(e.target.value, 10) || 5)
                  )
                )
              }
              className="w-full border border-neutral-300 px-3 py-3 min-h-[44px] text-base sm:text-[13px] focus:outline-none focus:border-black transition-colors"
            />
            <p className="text-[10px] text-neutral-400 mt-1">
              Time players have to join before PLAYING begins.
            </p>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
              Match seconds
            </label>
            <input
              type="number"
              min={30}
              max={3600}
              value={matchSeconds}
              onChange={(e) =>
                setMatchSeconds(
                  Math.max(
                    30,
                    Math.min(3600, parseInt(e.target.value, 10) || 30)
                  )
                )
              }
              className="w-full border border-neutral-300 px-3 py-3 min-h-[44px] text-base sm:text-[13px] focus:outline-none focus:border-black transition-colors"
            />
          </div>
        </div>
      )}

      {error && <p className="text-[12px] text-red-600">{error}</p>}
      {message && <p className="text-[12px] text-green-700">{message}</p>}

      <div className="flex flex-wrap gap-3">
        {!hasActive ? (
          <button
            type="button"
            onClick={startMatch}
            disabled={busy}
            className="bg-black text-white text-[11px] uppercase tracking-widest px-6 py-3 min-h-[44px] hover:bg-neutral-800 transition-colors disabled:bg-neutral-400"
          >
            {busy ? "Opening…" : "Open new match"}
          </button>
        ) : (
          <button
            type="button"
            onClick={endMatch}
            disabled={busy}
            className="border border-rose-600 text-rose-700 text-[11px] uppercase tracking-widest px-6 py-3 min-h-[44px] hover:bg-rose-600 hover:text-white transition-colors disabled:opacity-50"
          >
            {busy ? "Ending…" : "End current match"}
          </button>
        )}
      </div>
    </div>
  );
}
