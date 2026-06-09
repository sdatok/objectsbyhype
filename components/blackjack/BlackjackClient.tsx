"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { PublicBlackjackState } from "@/lib/blackjack-types";
import BlackjackTable from "@/components/blackjack/BlackjackTable";
import { useBlackjackDealAnimation } from "@/components/blackjack/useBlackjackDealAnimation";

const STORAGE_EMAIL = "obh-blackjack-email";
const STORAGE_NAME = "obh-blackjack-name";

interface BlackjackClientProps {
  initialState: PublicBlackjackState;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${pad(m)}:${pad(s)}`;
}

function outcomeLabel(outcome: string | null): string {
  switch (outcome) {
    case "BLACKJACK":
      return "Blackjack!";
    case "WIN":
      return "You win";
    case "PUSH":
      return "Push";
    case "LOSE":
      return "Dealer wins";
    case "BUST":
      return "Bust";
    default:
      return "";
  }
}

function WheelCodeWinner({
  code,
  placement,
}: {
  code: string;
  placement?: number | null;
}) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.getElementById("bj-wheel-code") as HTMLInputElement | null;
      input?.select();
      document.execCommand("copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="bj-casino-panel p-4 text-center w-full">
      <p className="text-[10px] uppercase tracking-widest text-amber-400 mb-1">
        You won a wheel spin
        {placement != null && (
          <span className="text-neutral-400"> · rank #{placement}</span>
        )}
      </p>
      <p className="text-[11px] text-emerald-200/80 mb-3">
        Copy your code, then spin on the giveaway wheel.
      </p>
      <div className="flex gap-2 mb-3">
        <input
          id="bj-wheel-code"
          readOnly
          value={code}
          onFocus={(e) => e.target.select()}
          onClick={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 bj-casino-input font-mono text-sm text-amber-300 text-center tracking-wider select-all"
        />
        <button
          type="button"
          onClick={copyCode}
          className="shrink-0 px-4 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white text-[10px] uppercase tracking-widest rounded font-bold transition-colors border border-emerald-600"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <a
        href="/giveawaywheel"
        target="_blank"
        rel="noopener noreferrer"
        className="bj-casino-btn bj-btn-deal inline-block"
      >
        Open giveaway wheel ↗
      </a>
    </div>
  );
}

export default function BlackjackClient({ initialState }: BlackjackClientProps) {
  const [state, setState] = useState(initialState);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [entryId, setEntryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myEntry = state.myEntry;
  const dealAnim = useBlackjackDealAnimation(myEntry ?? null);

  useEffect(() => {
    const savedEmail = localStorage.getItem(STORAGE_EMAIL) ?? "";
    const savedName = localStorage.getItem(STORAGE_NAME) ?? "";
    if (savedEmail) setEmail(savedEmail);
    if (savedName) setDisplayName(savedName);
  }, []);

  const refreshState = useCallback(async (viewerEmail?: string) => {
    const q = viewerEmail ? `?email=${encodeURIComponent(viewerEmail)}` : "";
    const res = await fetch(`/api/blackjack/state${q}`, { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as PublicBlackjackState;
    setState(json);
    if (json.myEntry) setEntryId(json.myEntry.id);
  }, []);

  useEffect(() => {
    const emailLower = email.trim().toLowerCase();
    const poll = () => {
      void refreshState(emailLower || undefined);
    };
    poll();
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, [email, refreshState]);

  useEffect(() => {
    if (initialState.myEntry) setEntryId(initialState.myEntry.id);
  }, [initialState.myEntry]);

  async function joinTable(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const trimmedEmail = email.trim().toLowerCase();
    localStorage.setItem(STORAGE_EMAIL, trimmedEmail);
    localStorage.setItem(STORAGE_NAME, displayName.trim());
    try {
      const res = await fetch("/api/blackjack/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, displayName }),
      });
      const json = (await res.json()) as { error?: string; entryId?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not join");
      if (json.entryId) setEntryId(json.entryId);
      await refreshState(trimmedEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join");
    } finally {
      setLoading(false);
    }
  }

  async function doAction(action: "hit" | "stand") {
    if (!entryId || dealAnim.isDealing) return;
    setActionLoading(true);
    setError(null);
    const trimmedEmail = email.trim().toLowerCase();
    try {
      const res = await fetch("/api/blackjack/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, entryId, action }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Action failed");
      await refreshState(trimmedEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  const playing = myEntry && !myEntry.finished;
  const finished = myEntry?.finished ?? false;
  const secondsLeft = state.currentRound?.secondsRemaining ?? 0;
  const wheelCode = myEntry?.wheelCode ?? state.recentResult?.wheelCode ?? null;
  const wheelPlacement =
    myEntry?.wheelCode != null
      ? myEntry.placement
      : state.recentResult?.placement ?? null;
  const controlsLocked = dealAnim.isDealing || actionLoading;

  return (
    <main className="flex-1 flex flex-col overflow-y-auto bj-casino-room">
      <header className="shrink-0 px-4 py-3 border-b border-amber-900/40 flex items-center justify-between gap-3 bg-black/50 backdrop-blur-sm">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-amber-400">
            ♠ Live Blackjack
          </p>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            Top 10 each round →{" "}
            <Link href="/giveawaywheel" className="text-amber-300 hover:underline">
              Giveaway Wheel
            </Link>
          </p>
        </div>
        {state.currentRound && (
          <div className="text-right bj-casino-panel px-3 py-2">
            <p className="text-[8px] uppercase tracking-widest text-neutral-500">
              Next hand
            </p>
            <p className="font-mono text-lg text-amber-300 tabular-nums leading-tight">
              {formatTime(secondsLeft)}
            </p>
            <p className="text-[8px] text-neutral-500">
              {state.currentRound.entryCount} at the table
            </p>
          </div>
        )}
      </header>

      <div className="flex-1 flex flex-col items-center p-4 gap-5 max-w-xl mx-auto w-full">
        <BlackjackTable
          entry={myEntry ?? null}
          prizeTitle={state.prizeTitle}
          outcomeLabel={
            finished && myEntry?.outcome
              ? outcomeLabel(myEntry.outcome)
              : null
          }
          placement={finished ? myEntry?.placement : null}
          anim={dealAnim}
        />

        {error && (
          <p className="text-sm text-red-400 text-center bj-casino-panel px-4 py-2 w-full">
            {error}
          </p>
        )}

        {!myEntry && (
          <form onSubmit={joinTable} className="w-full space-y-3 bj-casino-panel p-4">
            <p className="text-[10px] uppercase tracking-widest text-amber-400/80 text-center">
              Join the table
            </p>
            <input
              type="email"
              required
              placeholder="Email (for wheel code if you win)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bj-casino-input"
            />
            <input
              type="text"
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={32}
              className="bj-casino-input"
            />
            <button
              type="submit"
              disabled={loading || secondsLeft <= 0}
              className="bj-casino-btn bj-btn-deal"
            >
              {loading ? "Shuffling…" : "Place bet · Deal me in"}
            </button>
          </form>
        )}

        {playing && (
          <div className="flex gap-3 w-full">
            <button
              type="button"
              disabled={controlsLocked}
              onClick={() => doAction("hit")}
              className="bj-casino-btn bj-btn-hit"
            >
              Hit
            </button>
            <button
              type="button"
              disabled={controlsLocked}
              onClick={() => doAction("stand")}
              className="bj-casino-btn bj-btn-stand"
            >
              Stand
            </button>
          </div>
        )}

        {dealAnim.isDealing && playing && (
          <p className="text-[10px] text-amber-400/70 tracking-widest uppercase">
            Cards in play…
          </p>
        )}

        {wheelCode && (
          <WheelCodeWinner code={wheelCode} placement={wheelPlacement} />
        )}

        {finished && !wheelCode && (
          <p className="text-[11px] text-neutral-500 text-center">
            Hand locked in. Top 10 get wheel codes when the round ends.
          </p>
        )}

        {state.lastWinners.length > 0 && (
          <div className="w-full bj-casino-panel p-4">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
              Last round — top 10
            </p>
            <ol className="space-y-1 text-[11px]">
              {state.lastWinners.map((w) => (
                <li key={w.placement} className="flex justify-between gap-2">
                  <span>
                    #{w.placement} {w.displayName}{" "}
                    <span className="text-neutral-500">{w.outcome}</span>
                  </span>
                  <span className="text-neutral-500 shrink-0">{w.handValue}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </main>
  );
}
