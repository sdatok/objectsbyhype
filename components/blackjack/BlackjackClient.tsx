"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { PublicBlackjackState } from "@/lib/blackjack-types";
import BlackjackTable from "@/components/blackjack/BlackjackTable";
import BlackjackChatBar from "@/components/blackjack/BlackjackChatBar";
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

function formatGrantTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function outcomeSummary(outcomes: string[]): string {
  if (outcomes.length === 1) {
    switch (outcomes[0]) {
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
        return outcomes[0] ?? "";
    }
  }
  return outcomes.join(" · ");
}

function WheelCodePanel({
  code,
  label,
  href,
  linkLabel,
}: {
  code: string;
  label: string;
  href: string;
  linkLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="bj-casino-panel p-4 text-center w-full">
      <p className="text-[10px] uppercase tracking-widest text-amber-400 mb-1">
        {label}
      </p>
      <div className="flex gap-2 mb-3">
        <input
          readOnly
          value={code}
          onFocus={(e) => e.target.select()}
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
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="bj-casino-btn bj-btn-deal inline-block"
      >
        {linkLabel} ↗
      </a>
    </div>
  );
}

export default function BlackjackClient({ initialState }: BlackjackClientProps) {
  const [state, setState] = useState(initialState);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bet, setBet] = useState(initialState.imMinBet);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mySeat = state.mySeat;
  const dealAnim = useBlackjackDealAnimation(mySeat ?? null);

  useEffect(() => {
    const savedEmail = localStorage.getItem(STORAGE_EMAIL) ?? "";
    const savedName = localStorage.getItem(STORAGE_NAME) ?? "";
    if (savedEmail) setEmail(savedEmail);
    if (savedName) setDisplayName(savedName);
  }, []);

  useEffect(() => {
    if (mySeat?.currentBet && mySeat.currentBet >= state.imMinBet) {
      setBet(mySeat.currentBet);
    }
  }, [mySeat?.currentBet, state.imMinBet]);

  const refreshState = useCallback(async (viewerEmail?: string) => {
    const q = viewerEmail ? `?email=${encodeURIComponent(viewerEmail)}` : "";
    const res = await fetch(`/api/blackjack/state${q}`, { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as PublicBlackjackState;
    setState(json);
  }, []);

  useEffect(() => {
    const emailLower = email.trim().toLowerCase();
    const poll = () => {
      void refreshState(emailLower || undefined);
    };
    poll();
    const id = setInterval(poll, 2500);
    return () => clearInterval(id);
  }, [email, refreshState]);

  async function apiPost(path: string, body: Record<string, unknown>) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(json.error ?? "Request failed");
    return json;
  }

  async function sitDown(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const trimmedEmail = email.trim().toLowerCase();
    localStorage.setItem(STORAGE_EMAIL, trimmedEmail);
    localStorage.setItem(STORAGE_NAME, displayName.trim());
    try {
      await apiPost("/api/blackjack/sit", {
        email: trimmedEmail,
        displayName,
      });
      await refreshState(trimmedEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sit");
    } finally {
      setLoading(false);
    }
  }

  async function leaveTable() {
    setLoading(true);
    setError(null);
    const trimmedEmail = email.trim().toLowerCase();
    try {
      await apiPost("/api/blackjack/leave", { email: trimmedEmail });
      await refreshState(trimmedEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not leave");
    } finally {
      setLoading(false);
    }
  }

  async function saveCredits() {
    setLoading(true);
    setError(null);
    const trimmedEmail = email.trim().toLowerCase();
    try {
      await apiPost("/api/blackjack/save", { email: trimmedEmail });
      await refreshState(trimmedEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setLoading(false);
    }
  }

  async function dealHand() {
    setLoading(true);
    setError(null);
    const trimmedEmail = email.trim().toLowerCase();
    try {
      await apiPost("/api/blackjack/bet", { email: trimmedEmail, bet });
      await apiPost("/api/blackjack/deal", { email: trimmedEmail, bet });
      await refreshState(trimmedEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not deal");
    } finally {
      setLoading(false);
    }
  }

  async function doAction(action: "hit" | "stand" | "double" | "split") {
    if (dealAnim.isDealing) return;
    setActionLoading(true);
    setError(null);
    const trimmedEmail = email.trim().toLowerCase();
    try {
      await apiPost("/api/blackjack/action", { email: trimmedEmail, action });
      await refreshState(trimmedEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  const playing = mySeat?.handPhase === "PLAYING";
  const settled = mySeat?.handPhase === "SETTLED";
  const idle = mySeat?.handPhase === "IDLE" || settled;
  const secondsLeft = state.currentRound?.secondsRemaining ?? 0;
  const controlsLocked = dealAnim.isDealing || actionLoading || loading;

  const lastOutcomes = mySeat?.lastResult?.outcomes ?? [];
  const outcomeLabel =
    settled && lastOutcomes.length
      ? outcomeSummary(lastOutcomes)
      : null;

  const canSplit =
    playing &&
    mySeat &&
    mySeat.playerCards.length === 2 &&
    mySeat.handCount <= 1;
  const canDouble =
    playing &&
    mySeat &&
    mySeat.playerCards.length === 2 &&
    mySeat.stackCredits >= (mySeat.currentBet || bet);

  const inactiveWarning =
    mySeat &&
    mySeat.missedRounds > 0 &&
    mySeat.missedRounds < mySeat.inactiveKick
      ? `Inactive ${mySeat.missedRounds}/${mySeat.inactiveKick} rounds — play a hand or you'll lose your seat.`
      : null;

  return (
    <main className="flex-1 flex flex-col min-h-0 overflow-hidden bj-casino-room">
      <header className="shrink-0 px-4 py-3 border-b border-amber-900/40 flex items-center justify-between gap-3 bg-black/50 backdrop-blur-sm">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-amber-400">
            ♠ Live Blackjack
          </p>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            {state.imDailyGrant} IM daily · {state.imMilestoneGiveaway} IM →{" "}
            <Link href="/giveawaywheel" className="text-amber-300 hover:underline">
              Giveaway Wheel
            </Link>
            {" · "}
            {state.imMilestoneWoh} IM →{" "}
            <Link href="/wheelofhype" className="text-amber-300 hover:underline">
              Wheel of Hype
            </Link>
          </p>
        </div>
        {state.currentRound && (
          <div className="text-right bj-casino-panel px-3 py-2">
            <p className="text-[8px] uppercase tracking-widest text-neutral-500">
              Round timer
            </p>
            <p className="font-mono text-lg text-amber-300 tabular-nums leading-tight">
              {formatTime(secondsLeft)}
            </p>
            <p className="text-[8px] text-neutral-500">
              {state.currentRound.seatedCount}/{state.tableSeats} seated
            </p>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="flex flex-col items-center p-4 gap-5 max-w-3xl mx-auto w-full pb-4">
          <BlackjackTable
            mySeat={mySeat ?? null}
            seats={state.seats}
            tableSeats={state.tableSeats}
            outcomeLabel={outcomeLabel}
            anim={dealAnim}
          />

          {mySeat && (
            <div className="w-full bj-casino-panel p-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span>
                Stack{" "}
                <strong className="text-amber-300 tabular-nums">
                  {mySeat.stackCredits} IM
                </strong>
              </span>
              <span>
                Bank{" "}
                <strong className="text-emerald-300 tabular-nums">
                  {mySeat.savedCredits} IM
                </strong>
              </span>
              <span>
                Your bet{" "}
                <strong className="text-amber-200 tabular-nums">{bet} IM</strong>
              </span>
              <span className="text-neutral-500 text-[10px]">
                ({state.imMinBet}–{state.imMaxBet} IM)
              </span>
            </div>
          )}

          {inactiveWarning && (
            <p className="text-[11px] text-amber-400/90 text-center w-full">
              {inactiveWarning}
            </p>
          )}

          {error && (
            <p className="text-sm text-red-400 text-center bj-casino-panel px-4 py-2 w-full">
              {error}
            </p>
          )}

          {!mySeat && (
            <form onSubmit={sitDown} className="w-full space-y-3 bj-casino-panel p-4">
              <p className="text-[10px] uppercase tracking-widest text-amber-400/80 text-center">
                Take a seat · {state.imDailyGrant} internet monies daily
              </p>
              <input
                type="email"
                required
                placeholder="Email"
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
                disabled={loading}
                className="bj-casino-btn bj-btn-deal"
              >
                {loading ? "Seating…" : "Sit down"}
              </button>
            </form>
          )}

          {mySeat && !mySeat.canPlayToday && (
            <div className="w-full bj-casino-panel p-4 text-center">
              <p className="text-sm text-red-300 font-medium">
                You&apos;re out of internet monies
              </p>
              <p className="text-[11px] text-neutral-400 mt-2">
                Your daily {state.imDailyGrant} IM refreshes{" "}
                {mySeat.nextGrantAt
                  ? formatGrantTime(mySeat.nextGrantAt)
                  : "tomorrow (UTC)"}
                . Save winnings to your bank before you bust!
              </p>
            </div>
          )}

          {mySeat && idle && mySeat.canPlayToday && (
            <div className="w-full space-y-3 bj-casino-panel p-4">
              <label className="block text-[10px] uppercase tracking-widest text-amber-400/80">
                Bet amount
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="range"
                  min={state.imMinBet}
                  max={Math.min(state.imMaxBet, mySeat.stackCredits || state.imMaxBet)}
                  step={5}
                  value={Math.min(bet, mySeat.stackCredits || bet)}
                  onChange={(e) => setBet(Number(e.target.value))}
                  className="flex-1"
                />
                <input
                  type="number"
                  min={state.imMinBet}
                  max={state.imMaxBet}
                  step={5}
                  value={bet}
                  onChange={(e) => setBet(Number(e.target.value))}
                  className="w-20 bj-casino-input text-center tabular-nums"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {[state.imMinBet, 25, 50, 100].map((v) => (
                  <button
                    key={v}
                    type="button"
                    disabled={v > mySeat.stackCredits}
                    onClick={() => setBet(Math.min(v, mySeat.stackCredits))}
                    className="px-3 py-1 text-[10px] uppercase tracking-wider border border-amber-800/50 rounded text-amber-200/80 hover:bg-amber-900/30 disabled:opacity-30"
                  >
                    {v}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={controlsLocked || bet > mySeat.stackCredits || bet < state.imMinBet}
                onClick={dealHand}
                className="bj-casino-btn bj-btn-deal w-full"
              >
                {loading ? "Dealing…" : settled ? "Next hand · Deal" : "Deal"}
              </button>
              {settled && mySeat.lastResult && (
                <p className="text-center text-[11px] text-neutral-400">
                  {outcomeSummary(mySeat.lastResult.outcomes)}{" "}
                  <span
                    className={
                      mySeat.lastResult.netChange >= 0
                        ? "text-emerald-400"
                        : "text-red-400"
                    }
                  >
                    {mySeat.lastResult.netChange >= 0 ? "+" : ""}
                    {mySeat.lastResult.netChange} IM
                  </span>
                </p>
              )}
            </div>
          )}

          {playing && (
            <div className="flex flex-wrap gap-2 w-full">
              <button
                type="button"
                disabled={controlsLocked}
                onClick={() => doAction("hit")}
                className="bj-casino-btn bj-btn-hit flex-1 min-w-[80px]"
              >
                Hit
              </button>
              <button
                type="button"
                disabled={controlsLocked}
                onClick={() => doAction("stand")}
                className="bj-casino-btn bj-btn-stand flex-1 min-w-[80px]"
              >
                Stand
              </button>
              {canDouble && (
                <button
                  type="button"
                  disabled={controlsLocked}
                  onClick={() => doAction("double")}
                  className="bj-casino-btn flex-1 min-w-[80px] border border-amber-600 text-amber-200"
                >
                  Double
                </button>
              )}
              {canSplit && (
                <button
                  type="button"
                  disabled={controlsLocked}
                  onClick={() => doAction("split")}
                  className="bj-casino-btn flex-1 min-w-[80px] border border-amber-600 text-amber-200"
                >
                  Split
                </button>
              )}
            </div>
          )}

          {mySeat && (
            <div className="flex gap-2 w-full">
              <button
                type="button"
                disabled={controlsLocked || mySeat.stackCredits <= 0 || playing}
                onClick={saveCredits}
                className="flex-1 py-2 text-[10px] uppercase tracking-widest border border-emerald-800/60 text-emerald-300 rounded hover:bg-emerald-950/40 disabled:opacity-40"
              >
                Save stack to bank
              </button>
              <button
                type="button"
                disabled={controlsLocked || playing}
                onClick={leaveTable}
                className="px-4 py-2 text-[10px] uppercase tracking-widest border border-neutral-700 text-neutral-400 rounded hover:bg-neutral-900/40 disabled:opacity-40"
              >
                Leave
              </button>
            </div>
          )}

          {mySeat?.pendingGwCode && (
            <WheelCodePanel
              code={mySeat.pendingGwCode}
              label={`Giveaway wheel · ${state.imMilestoneGiveaway} IM milestone`}
              href="/giveawaywheel"
              linkLabel="Open giveaway wheel"
            />
          )}

          {mySeat?.pendingWohCode && (
            <WheelCodePanel
              code={mySeat.pendingWohCode}
              label={`Wheel of Hype · ${state.imMilestoneWoh} IM milestone`}
              href="/wheelofhype"
              linkLabel="Open Wheel of Hype"
            />
          )}

          {state.leaderboard.length > 0 && (
            <div className="w-full bj-casino-panel p-4">
              <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
                Biggest stacks (peak IM)
              </p>
              <ol className="space-y-1 text-[11px]">
                {state.leaderboard.map((row) => (
                  <li key={row.rank} className="flex justify-between gap-2">
                    <span>
                      #{row.rank} {row.displayName}{" "}
                      <span className="text-neutral-500">{row.email}</span>
                    </span>
                    <span className="text-amber-300 tabular-nums shrink-0">
                      {row.peakStack} IM
                      {row.savedCredits > 0 && (
                        <span className="text-neutral-500 ml-1">
                          ({row.savedCredits} banked)
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      <BlackjackChatBar
        roundId={state.currentRound?.id ?? null}
        email={email}
        displayName={displayName}
        enabled={state.enabled}
      />
    </main>
  );
}
