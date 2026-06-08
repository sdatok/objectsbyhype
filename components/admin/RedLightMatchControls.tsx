"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clampLobbySeconds,
  clampMatchSeconds,
  RED_LIGHT_MAX_LOBBY_SECONDS,
  RED_LIGHT_MAX_MATCH_SECONDS,
  RED_LIGHT_MIN_LOBBY_SECONDS,
  RED_LIGHT_MIN_MATCH_SECONDS,
} from "@/lib/red-light-config";

interface InitialControls {
  hasActive: boolean;
  currentMatchId: string | null;
  currentStatus: "WAITING" | "PLAYING" | "ENDED" | null;
  defaultMatchSeconds: number;
}

interface RedLightState {
  enabled: boolean;
  prizeTitle: string;
  currentMatch: {
    id: string;
    status: "WAITING" | "PLAYING" | "ENDED" | "COUNTDOWN";
    participantCount: number;
  } | null;
}

interface RedLightMatchControlsProps {
  initial: InitialControls;
}

export default function RedLightMatchControls({ initial }: RedLightMatchControlsProps) {
  const router = useRouter();
  const [lobbySecondsInput, setLobbySecondsInput] = useState("60");
  const [matchSecondsInput, setMatchSecondsInput] = useState(
    String(initial.defaultMatchSeconds)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<RedLightState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await fetch("/api/red-light/state", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as RedLightState;
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
    !!liveMatchId && (liveStatus === "WAITING" || liveStatus === "PLAYING" || liveStatus === "COUNTDOWN");

  function normalizeLobbyInput(raw: string): string {
    return String(clampLobbySeconds(raw, 60));
  }

  function normalizeMatchInput(raw: string): string {
    return String(clampMatchSeconds(raw, initial.defaultMatchSeconds));
  }

  async function startMatch() {
    const lobbySeconds = clampLobbySeconds(lobbySecondsInput, 60);
    const matchSeconds = clampMatchSeconds(
      matchSecondsInput,
      initial.defaultMatchSeconds
    );
    setLobbySecondsInput(String(lobbySeconds));
    setMatchSecondsInput(String(matchSeconds));

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/red-light/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchSeconds, lobbySeconds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Start failed");
      setMessage(
        `Match opened (${data.matchId}). Countdown: ${data.lobbySeconds}s · length: ${data.matchSeconds}s.`
      );
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
      const res = await fetch("/api/admin/red-light/end", { method: "POST" });
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
          Up to 100 players join at <code>/red-light</code>. Hold to move on
          green — freeze on red. First across the finish wins.
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
              min={RED_LIGHT_MIN_LOBBY_SECONDS}
              max={RED_LIGHT_MAX_LOBBY_SECONDS}
              step={1}
              value={lobbySecondsInput}
              onChange={(e) => setLobbySecondsInput(e.target.value)}
              onBlur={() =>
                setLobbySecondsInput(normalizeLobbyInput(lobbySecondsInput))
              }
              className="w-full border border-neutral-300 px-3 py-3 min-h-[44px] text-base sm:text-[13px] focus:outline-none focus:border-black transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
              Match seconds
            </label>
            <input
              type="number"
              min={RED_LIGHT_MIN_MATCH_SECONDS}
              max={RED_LIGHT_MAX_MATCH_SECONDS}
              step={1}
              value={matchSecondsInput}
              onChange={(e) => setMatchSecondsInput(e.target.value)}
              onBlur={() =>
                setMatchSecondsInput(normalizeMatchInput(matchSecondsInput))
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
