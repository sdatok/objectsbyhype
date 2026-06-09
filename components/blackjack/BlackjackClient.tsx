"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { PublicBlackjackState } from "@/lib/blackjack-types";
import type { BJCard } from "@/lib/blackjack-engine";
import { cardLabel } from "@/lib/blackjack-engine";

const STORAGE_EMAIL = "obh-blackjack-email";
const STORAGE_NAME = "obh-blackjack-name";

interface BlackjackClientProps {
  initialState: PublicBlackjackState;
}

const SUIT_SYMBOLS = ["♠", "♥", "♦", "♣"];
const SUIT_COLORS = [
  "text-neutral-900",
  "text-red-600",
  "text-red-600",
  "text-neutral-900",
];

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

function PlayingCard({
  card,
  hidden,
}: {
  card?: BJCard;
  hidden?: boolean;
}) {
  if (hidden || !card) {
    return (
      <div className="w-14 h-20 sm:w-16 sm:h-24 rounded-md border-2 border-amber-600/50 bg-gradient-to-br from-amber-900 to-amber-950 flex items-center justify-center shadow-lg">
        <span className="text-amber-500/60 text-xl">♠</span>
      </div>
    );
  }

  const color = SUIT_COLORS[card.suit] ?? "text-white";
  const symbol = SUIT_SYMBOLS[card.suit] ?? "?";

  return (
    <div className="w-14 h-20 sm:w-16 sm:h-24 rounded-md border border-neutral-300 bg-white text-black flex flex-col justify-between p-1.5 shadow-lg">
      <span className={`text-xs font-bold leading-none ${color}`}>
        {cardLabel(card).slice(0, -1)}
        <span className="block text-[10px]">{symbol}</span>
      </span>
      <span className={`text-xl self-center ${color}`}>{symbol}</span>
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
    if (!entryId) return;
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

  const myEntry = state.myEntry;
  const resultEntry = myEntry ?? state.recentResult;
  const playing = myEntry && !myEntry.finished;
  const finished = myEntry?.finished ?? false;
  const secondsLeft = state.currentRound?.secondsRemaining ?? 0;

  return (
    <main className="flex-1 flex flex-col overflow-y-auto">
      <header className="shrink-0 px-4 py-3 border-b border-emerald-900/60 flex items-center justify-between gap-3 bg-black/30">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-400">
            ♠ OBH Blackjack
          </p>
          <p className="text-xs text-emerald-200/70 mt-0.5">
            Top 10 each round →{" "}
            <Link href="/giveawaywheel" className="underline text-amber-300">
              Giveaway Wheel
            </Link>
          </p>
        </div>
        {state.currentRound && (
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-widest text-neutral-400">
              Next hand in
            </p>
            <p className="font-mono text-lg text-amber-300 tabular-nums">
              {formatTime(secondsLeft)}
            </p>
            <p className="text-[9px] text-neutral-500">
              {state.currentRound.entryCount} played
            </p>
          </div>
        )}
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6 max-w-lg mx-auto w-full">
        <div className="w-full rounded-xl border border-emerald-700/40 bg-gradient-to-b from-emerald-900/80 to-emerald-950 p-5 shadow-2xl">
          <p className="text-center text-[10px] uppercase tracking-widest text-emerald-300/80 mb-4">
            {state.prizeTitle}
          </p>

          {/* Dealer */}
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2 text-center">
              Dealer
            </p>
            <div className="flex justify-center gap-2 min-h-[6rem]">
              {myEntry ? (
                <>
                  {myEntry.dealerCards.map((c, i) => (
                    <PlayingCard key={i} card={c} />
                  ))}
                  {myEntry.dealerHidden && <PlayingCard hidden />}
                </>
              ) : (
                <p className="text-sm text-neutral-500 self-center">
                  Join to be dealt in
                </p>
              )}
            </div>
          </div>

          {/* Player */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2 text-center">
              Your hand
              {myEntry && (
                <span className="ml-2 text-amber-300">{myEntry.handValue}</span>
              )}
            </p>
            <div className="flex justify-center gap-2 min-h-[6rem]">
              {myEntry ? (
                myEntry.playerCards.map((c, i) => (
                  <PlayingCard key={i} card={c} />
                ))
              ) : (
                <p className="text-sm text-neutral-500 self-center">
                  One hand per round
                </p>
              )}
            </div>
          </div>

          {finished && myEntry?.outcome && (
            <p className="text-center mt-4 text-sm font-bold text-amber-300">
              {outcomeLabel(myEntry.outcome)}
              {myEntry.placement != null && (
                <span className="block text-[11px] font-normal text-neutral-400 mt-1">
                  Rank #{myEntry.placement} this round
                </span>
              )}
              {myEntry.wheelCode && (
                <span className="block mt-2 text-emerald-300 font-mono text-xs">
                  Wheel code: {myEntry.wheelCode}
                  <Link
                    href="/giveawaywheel"
                    className="block text-[10px] underline mt-1 font-sans"
                  >
                    Spin at /giveawaywheel →
                  </Link>
                </span>
              )}
            </p>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-400 text-center">{error}</p>
        )}

        {!myEntry && (
          <form onSubmit={joinTable} className="w-full space-y-3">
            <input
              type="email"
              required
              placeholder="Email (for wheel code if you win)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/40 border border-emerald-800 px-3 py-2.5 text-sm rounded"
            />
            <input
              type="text"
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={32}
              className="w-full bg-black/40 border border-emerald-800 px-3 py-2.5 text-sm rounded"
            />
            <button
              type="submit"
              disabled={loading || secondsLeft <= 0}
              className="w-full py-3 bg-amber-500 text-black font-bold text-xs uppercase tracking-widest rounded disabled:opacity-40"
            >
              {loading ? "Dealing…" : "Deal me in"}
            </button>
          </form>
        )}

        {playing && (
          <div className="flex gap-3 w-full">
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => doAction("hit")}
              className="flex-1 py-3 border-2 border-amber-500 text-amber-300 font-bold text-xs uppercase tracking-widest rounded disabled:opacity-40"
            >
              Hit
            </button>
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => doAction("stand")}
              className="flex-1 py-3 bg-amber-500 text-black font-bold text-xs uppercase tracking-widest rounded disabled:opacity-40"
            >
              Stand
            </button>
          </div>
        )}

        {resultEntry?.wheelCode && !myEntry && (
          <div className="w-full border border-emerald-600/50 rounded p-4 bg-black/30 text-center">
            <p className="text-[10px] uppercase tracking-widest text-emerald-400 mb-2">
              Last round — you placed #{resultEntry.placement}
            </p>
            <p className="font-mono text-amber-300">{resultEntry.wheelCode}</p>
            <Link
              href="/giveawaywheel"
              className="block text-[11px] underline mt-2 text-emerald-300"
            >
              Spin at /giveawaywheel →
            </Link>
          </div>
        )}

        {finished && !myEntry?.wheelCode && !state.recentResult?.wheelCode && (
          <p className="text-[11px] text-neutral-400 text-center">
            Hand locked in. Top 10 get wheel codes when the round ends.
          </p>
        )}

        {state.lastWinners.length > 0 && (
          <div className="w-full border border-emerald-800/50 rounded p-4 bg-black/20">
            <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2">
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
