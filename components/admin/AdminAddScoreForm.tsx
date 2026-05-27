"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminAddScoreForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [score, setScore] = useState("");
  const [secondsPlayed, setSecondsPlayed] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const res = await fetch("/api/admin/game/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          email,
          score: Number(score),
          secondsPlayed: Number(secondsPlayed),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        updated?: boolean;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not save score");
        return;
      }
      setDisplayName("");
      setEmail("");
      setScore("");
      setSecondsPlayed("");
      setMessage(
        data.updated
          ? "Score updated on the current leaderboard."
          : "Score added to the current leaderboard."
      );
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-4 pb-4 border-b border-neutral-100 space-y-3"
    >
      <p className="text-[10px] uppercase tracking-widest text-neutral-500">
        Add custom score
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-neutral-400">
            Name
          </span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Player name"
            maxLength={32}
            className="mt-1 w-full border border-neutral-200 rounded px-2 py-1.5 text-[12px]"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-neutral-400">
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="player@email.com"
            required
            className="mt-1 w-full border border-neutral-200 rounded px-2 py-1.5 text-[12px]"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-neutral-400">
            Score
          </span>
          <input
            type="number"
            min={0}
            step={1}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="1234"
            required
            className="mt-1 w-full border border-neutral-200 rounded px-2 py-1.5 text-[12px] font-mono"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-neutral-400">
            Time (seconds)
          </span>
          <input
            type="number"
            min={0}
            step={1}
            value={secondsPlayed}
            onChange={(e) => setSecondsPlayed(e.target.value)}
            placeholder="42"
            required
            className="mt-1 w-full border border-neutral-200 rounded px-2 py-1.5 text-[12px] font-mono"
          />
        </label>
      </div>
      {error && (
        <p className="text-[11px] text-red-600">{error}</p>
      )}
      {message && (
        <p className="text-[11px] text-emerald-700">{message}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="text-[10px] uppercase tracking-widest font-bold px-3 py-2 border border-black hover:bg-black hover:text-white transition-colors disabled:opacity-50"
      >
        {pending ? "Saving…" : "Add to leaderboard"}
      </button>
    </form>
  );
}
