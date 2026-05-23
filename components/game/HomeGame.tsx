"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BRAND_IDS,
  STATION_IDS,
  STATION_LABELS,
  type ActiveTask,
  type StationId,
} from "./GameScene";

// SSR-safe: r3f's Canvas needs the browser window.
const GameScene = dynamic(() => import("./GameScene"), { ssr: false });

interface PublicScore {
  email: string;
  displayName: string | null;
  score: number;
  createdAt: string;
}

interface PublicGameState {
  enabled: boolean;
  prizeTitle: string;
  prizeDescription: string | null;
  windowStartedAt: string;
  windowEndsAt: string;
  windowHours: number;
  gameSpeed: number;
  maxMisses: number;
  taskBaseSeconds: number;
  leaderboard: PublicScore[];
  lastWinner: PublicScore | null;
}

type Phase = "idle" | "playing" | "gameOver" | "submitted";

const POINTS_PER_TASK = 10;
const WRONG_TAP_PENALTY = 2;
const MIN_SPAWN_MS = 700;

interface RemainingTime {
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function computeRemaining(endsAt: number): RemainingTime {
  const diff = endsAt - Date.now();
  if (diff <= 0) {
    return { hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  const totalSeconds = Math.floor(diff / 1000);
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    expired: false,
  };
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export default function HomeGame() {
  const [state, setState] = useState<PublicGameState | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [tasks, setTasks] = useState<ActiveTask[]>([]);
  const [characterAt, setCharacterAt] = useState<StationId>("packing");
  const [flashStation, setFlashStation] = useState<StationId | null>(null);
  const [remaining, setRemaining] = useState<RemainingTime>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    expired: false,
  });
  const startedAtRef = useRef<number>(0);
  const lastSpawnRef = useRef<number>(0);
  const nextTaskIdRef = useRef<number>(0);
  const elapsedSecondsRef = useRef<number>(0);

  // Submission UI
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Live refs of values the game loop uses, so the loop doesn't have to be a
  // dependency of state setters.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const stateRef = useRef(state);
  stateRef.current = state;

  /** Load state initially and whenever a window rolls. */
  const loadState = useCallback(async () => {
    try {
      const res = await fetch("/api/game/state", { cache: "no-store" });
      if (!res.ok) throw new Error("state fetch failed");
      const json: PublicGameState = await res.json();
      setState(json);
      setStateError(null);
    } catch {
      setStateError("Couldn't load the giveaway. Refresh to try again.");
    }
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  // Countdown ticker — updates every second.
  useEffect(() => {
    if (!state) return;
    const endsAt = new Date(state.windowEndsAt).getTime();
    setRemaining(computeRemaining(endsAt));
    const id = window.setInterval(() => {
      const next = computeRemaining(endsAt);
      setRemaining(next);
      if (next.expired) {
        // Refetch — the server will roll the window.
        loadState();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [state, loadState]);

  // -------- Game loop --------
  useEffect(() => {
    if (phase !== "playing") return;
    let raf = 0;
    function tick() {
      const now = performance.now();
      const cfg = stateRef.current;
      if (!cfg) return;

      elapsedSecondsRef.current = Math.floor((now - startedAtRef.current) / 1000);

      // Difficulty curve: spawn interval shrinks ~1% per second, bounded.
      const baseSpawn = Math.max(
        MIN_SPAWN_MS,
        2200 / cfg.gameSpeed - elapsedSecondsRef.current * 18
      );

      // Spawn if it's been long enough AND there's a free station.
      if (now - lastSpawnRef.current > baseSpawn) {
        const occupied = new Set(tasksRef.current.map((t) => t.stationId));
        const free = STATION_IDS.filter((s) => !occupied.has(s));
        if (free.length > 0) {
          const station = free[Math.floor(Math.random() * free.length)];
          const brand = BRAND_IDS[Math.floor(Math.random() * BRAND_IDS.length)];
          const baseMs = cfg.taskBaseSeconds * 1000;
          const decayed = Math.max(
            1500,
            baseMs - elapsedSecondsRef.current * 60
          );
          const id = `t${nextTaskIdRef.current++}`;
          const newTask: ActiveTask = {
            id,
            stationId: station,
            brand,
            spawnedAt: now,
            expiresAt: now + decayed,
          };
          setTasks((prev) => [...prev, newTask]);
          lastSpawnRef.current = now;
        }
      }

      // Expire tasks whose deadlines passed.
      const expired = tasksRef.current.filter((t) => t.expiresAt <= now);
      if (expired.length > 0) {
        setTasks((prev) => prev.filter((t) => t.expiresAt > now));
        setMisses((prev) => {
          const next = prev + expired.length;
          if (next >= (stateRef.current?.maxMisses ?? 3)) {
            // End the game on the next frame so state updates settle first.
            queueMicrotask(() => setPhase("gameOver"));
          }
          return next;
        });
      }

      raf = window.requestAnimationFrame(tick);
    }
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [phase]);

  function startGame() {
    setScore(0);
    setMisses(0);
    setTasks([]);
    setCharacterAt("packing");
    setFlashStation(null);
    setSubmitError(null);
    nextTaskIdRef.current = 0;
    startedAtRef.current = performance.now();
    // Give a generous head start before the first spawn.
    lastSpawnRef.current = performance.now() - 200;
    elapsedSecondsRef.current = 0;
    setPhase("playing");
  }

  function handleStationClick(id: StationId) {
    if (phaseRef.current !== "playing") return;
    setCharacterAt(id);
    const hit = tasksRef.current.find((t) => t.stationId === id);
    if (hit) {
      setTasks((prev) => prev.filter((t) => t.id !== hit.id));
      setScore((s) => s + POINTS_PER_TASK);
      setFlashStation(id);
      window.setTimeout(() => setFlashStation((f) => (f === id ? null : f)), 220);
    } else {
      setScore((s) => Math.max(0, s - WRONG_TAP_PENALTY));
    }
  }

  // Keyboard controls — 1, 2, 3 map to the three stations.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phaseRef.current !== "playing") return;
      if (e.key === "1") handleStationClick("computer");
      else if (e.key === "2") handleStationClick("packing");
      else if (e.key === "3") handleStationClick("camera");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function submitScore(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/game/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          displayName: displayName.trim() || undefined,
          score,
          secondsPlayed: elapsedSecondsRef.current,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Submit failed");
      }
      setPhase("submitted");
      loadState();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (stateError) {
    return (
      <section className="bg-[#0b0214] text-white px-4 py-8 text-center text-[12px] uppercase tracking-widest text-neutral-400">
        {stateError}
      </section>
    );
  }
  if (!state) {
    return (
      <section className="bg-[#0b0214] text-white px-4 py-12 text-center text-[11px] uppercase tracking-widest text-neutral-500">
        Loading the giveaway…
      </section>
    );
  }
  if (!state.enabled) {
    return null;
  }

  return (
    <section
      aria-label="OBH Giveaway Game"
      className="relative overflow-hidden"
      style={{
        background:
          "radial-gradient(80% 80% at 50% 0%, #2a0b4d 0%, #0b0214 60%, #050108 100%)",
      }}
    >
      {/* Decorative neon glow at the top, like the Ship NYC hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-32 h-64 blur-3xl opacity-60"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 50%, rgba(232,121,249,0.55), transparent 70%)",
        }}
      />

      <div className="relative max-w-[1600px] mx-auto px-4 py-8 md:py-12 text-white">
        {/* Top strip: prize + countdown */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.32em] text-fuchsia-400">
              Hourly Giveaway
            </p>
            <h2 className="text-white font-black uppercase tracking-[0.06em] text-[26px] sm:text-[34px] md:text-[44px] leading-[1.0] mt-2">
              {state.prizeTitle}
            </h2>
            {state.prizeDescription && (
              <p className="text-[13px] sm:text-[14px] text-neutral-300 mt-2 max-w-md leading-relaxed font-medium">
                {state.prizeDescription}
              </p>
            )}
          </div>
          <div className="text-left md:text-right">
            <p className="text-[12px] font-bold uppercase tracking-[0.32em] text-fuchsia-400">
              Next winner in
            </p>
            <p
              className="font-mono font-black text-white text-[40px] sm:text-[52px] md:text-[64px] leading-none mt-1 tabular-nums"
              style={{
                textShadow:
                  "0 0 24px rgba(232,121,249,0.85), 0 0 4px rgba(232,121,249,1)",
              }}
            >
              {pad(remaining.hours)}:{pad(remaining.minutes)}:
              {pad(remaining.seconds)}
            </p>
          </div>
        </div>

        {/* HUD: score / misses / start */}
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-fuchsia-400">
                Score
              </p>
              <p className="font-mono font-black text-[26px] tabular-nums text-white">
                {score.toString().padStart(4, "0")}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-fuchsia-400">
                Misses
              </p>
              <p className="font-mono font-black text-[26px] tabular-nums">
                <span className="text-white">{misses}</span>
                <span className="text-neutral-500"> / {state.maxMisses}</span>
              </p>
            </div>
          </div>
          {phase === "idle" && (
            <button
              type="button"
              onClick={startGame}
              className="text-[13px] font-bold uppercase tracking-[0.18em] px-6 py-3 min-h-[48px] text-white transition-transform hover:scale-[1.03]"
              style={{
                background:
                  "linear-gradient(135deg, #c026d3 0%, #7c3aed 100%)",
                boxShadow: "0 0 24px rgba(192,38,211,0.55)",
              }}
            >
              Play to win
            </button>
          )}
          {phase === "playing" && (
            <button
              type="button"
              onClick={() => setPhase("gameOver")}
              className="border border-fuchsia-700/60 text-fuchsia-300 text-[12px] font-bold uppercase tracking-widest px-4 py-3 min-h-[44px] hover:border-fuchsia-400 hover:text-white transition-colors"
            >
              End round
            </button>
          )}
        </div>

        {/* 3D canvas */}
        <div
          className="relative w-full overflow-hidden rounded-lg border border-fuchsia-900/50 h-[44vh] sm:h-[48vh] md:h-[54vh] min-h-[320px]"
          style={{
            boxShadow:
              "0 0 40px rgba(192,38,211,0.35), inset 0 0 0 1px rgba(232,121,249,0.15)",
          }}
        >
          <GameScene
            tasks={tasks}
            characterAt={characterAt}
            flashStation={flashStation}
            onStationClick={handleStationClick}
          />

          {/* Station name labels */}
          <div className="absolute inset-x-0 bottom-2 px-3 pointer-events-none">
            <div className="grid grid-cols-3 gap-2 text-center">
              {STATION_IDS.map((id, i) => (
                <div
                  key={id}
                  className="text-[11px] sm:text-[12px] font-bold uppercase tracking-widest text-fuchsia-300/90"
                  style={{ textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}
                >
                  <span className="hidden sm:inline text-fuchsia-500">
                    {i + 1} ·{" "}
                  </span>
                  {STATION_LABELS[id]}
                </div>
              ))}
            </div>
          </div>

          {/* Touch buttons for mobile while playing */}
          {phase === "playing" && (
            <div className="absolute inset-x-0 bottom-8 px-3 md:hidden pointer-events-none">
              <div className="grid grid-cols-3 gap-2">
                {STATION_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleStationClick(id)}
                    className="pointer-events-auto min-h-[48px] text-[12px] font-bold uppercase tracking-widest text-white border border-fuchsia-400/60 bg-fuchsia-950/60 backdrop-blur-sm active:bg-fuchsia-700 transition-colors"
                    style={{
                      boxShadow: "0 0 16px rgba(232,121,249,0.35)",
                    }}
                  >
                    {STATION_LABELS[id]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Idle overlay — explains the game */}
          {phase === "idle" && (
            <div
              className="absolute inset-0 flex items-end justify-center pointer-events-none"
              style={{
                background:
                  "linear-gradient(to top, rgba(11,2,20,0.95) 0%, rgba(11,2,20,0.6) 45%, transparent 100%)",
              }}
            >
              <div className="pb-10 px-4 text-center max-w-md">
                <p className="text-[12px] font-bold uppercase tracking-[0.32em] text-fuchsia-400">
                  How to play
                </p>
                <p className="text-[14px] text-neutral-200 mt-3 leading-relaxed font-medium">
                  Run the OBH ops desk. Tap a workstation when a{" "}
                  <span className="text-fuchsia-300 font-bold">Supreme</span>,{" "}
                  <span className="text-emerald-300 font-bold">BAPE</span>,{" "}
                  <span className="text-slate-200 font-bold">
                    Chrome Hearts
                  </span>{" "}
                  or{" "}
                  <span className="text-amber-300 font-bold">Bear Brick</span>{" "}
                  drops in. Miss {state.maxMisses} and you&apos;re out — top
                  score this window wins the prize.
                </p>
                <p className="text-[11px] font-bold uppercase tracking-widest text-fuchsia-500 mt-4">
                  Desktop: press 1, 2, 3
                </p>
              </div>
            </div>
          )}

          {/* Game over modal */}
          {phase === "gameOver" && (
            <div className="absolute inset-0 bg-[rgba(11,2,20,0.92)] backdrop-blur-sm flex items-center justify-center p-4">
              <form
                onSubmit={submitScore}
                className="w-full max-w-sm space-y-4"
              >
                <div className="text-center">
                  <p className="text-[12px] font-bold uppercase tracking-[0.32em] text-fuchsia-400">
                    Round over
                  </p>
                  <p
                    className="font-mono font-black text-[56px] tabular-nums text-white mt-1"
                    style={{
                      textShadow: "0 0 30px rgba(232,121,249,0.85)",
                    }}
                  >
                    {score.toString().padStart(4, "0")}
                  </p>
                  <p className="text-[13px] text-neutral-300 font-medium">
                    Submit to be eligible for{" "}
                    <span className="text-fuchsia-300 font-bold">
                      {state.prizeTitle}
                    </span>
                  </p>
                </div>
                <input
                  type="email"
                  inputMode="email"
                  autoCapitalize="off"
                  autoCorrect="off"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="w-full bg-[#1a0633] border border-fuchsia-700/60 px-3 py-3 min-h-[48px] text-base text-white placeholder-neutral-500 focus:outline-none focus:border-fuchsia-400 transition-colors"
                />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Display name (optional)"
                  maxLength={32}
                  className="w-full bg-[#1a0633] border border-fuchsia-700/60 px-3 py-3 min-h-[48px] text-base text-white placeholder-neutral-500 focus:outline-none focus:border-fuchsia-400 transition-colors"
                />
                {submitError && (
                  <p className="text-[12px] text-rose-400 font-bold">
                    {submitError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full text-[13px] font-bold uppercase tracking-[0.18em] px-5 py-3 min-h-[48px] text-white disabled:opacity-50"
                  style={{
                    background:
                      "linear-gradient(135deg, #c026d3 0%, #7c3aed 100%)",
                    boxShadow: "0 0 24px rgba(192,38,211,0.55)",
                  }}
                >
                  {submitting ? "Submitting…" : "Submit score"}
                </button>
                <button
                  type="button"
                  onClick={startGame}
                  className="w-full border border-fuchsia-700/60 text-[12px] font-bold uppercase tracking-widest text-fuchsia-300 px-5 py-3 min-h-[44px] hover:border-fuchsia-400 hover:text-white transition-colors"
                >
                  Play again without submitting
                </button>
              </form>
            </div>
          )}

          {/* Submitted */}
          {phase === "submitted" && (
            <div className="absolute inset-0 bg-[rgba(11,2,20,0.92)] backdrop-blur-sm flex items-center justify-center p-4">
              <div className="text-center max-w-sm space-y-3 text-white">
                <p className="text-[12px] font-bold uppercase tracking-[0.32em] text-fuchsia-400">
                  Submitted
                </p>
                <p
                  className="font-mono font-black text-[40px] tabular-nums"
                  style={{
                    textShadow: "0 0 24px rgba(232,121,249,0.85)",
                  }}
                >
                  {score.toString().padStart(4, "0")}
                </p>
                <p className="text-[13px] text-neutral-300 font-medium leading-relaxed">
                  If your score is highest when the countdown hits zero,
                  we&apos;ll email you about{" "}
                  <span className="text-fuchsia-300 font-bold">
                    {state.prizeTitle}
                  </span>
                  .
                </p>
                <button
                  type="button"
                  onClick={startGame}
                  className="text-[13px] font-bold uppercase tracking-[0.18em] px-6 py-3 min-h-[48px] text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, #c026d3 0%, #7c3aed 100%)",
                    boxShadow: "0 0 24px rgba(192,38,211,0.55)",
                  }}
                >
                  Try again
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Leaderboard + last winner */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.32em] text-fuchsia-400 mb-3">
              This window&apos;s leaderboard
            </p>
            {state.leaderboard.length === 0 ? (
              <p className="text-[13px] text-neutral-500 italic">
                No scores yet. Be the first.
              </p>
            ) : (
              <ol className="space-y-2">
                {state.leaderboard.slice(0, 5).map((s, i) => (
                  <li
                    key={`${s.email}-${s.createdAt}`}
                    className="flex items-center justify-between text-[14px] border-b border-fuchsia-900/40 pb-2"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="text-[11px] font-black uppercase tracking-widest text-fuchsia-500 w-5">
                        {i + 1}
                      </span>
                      <span className="font-bold text-white truncate">
                        {s.displayName || s.email.split("@")[0]}
                      </span>
                    </span>
                    <span className="font-mono font-black tabular-nums text-white shrink-0">
                      {s.score.toString().padStart(4, "0")}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.32em] text-fuchsia-400 mb-3">
              Last window&apos;s winner
            </p>
            {state.lastWinner ? (
              <div className="text-[14px] text-neutral-200">
                <p className="font-black text-white text-[16px]">
                  {state.lastWinner.displayName ||
                    state.lastWinner.email.split("@")[0]}
                </p>
                <p className="text-neutral-400 mt-1 font-medium">
                  Score{" "}
                  <span className="font-mono font-bold tabular-nums text-fuchsia-300">
                    {state.lastWinner.score}
                  </span>
                </p>
                <p className="text-[12px] text-neutral-500 mt-1">
                  {state.lastWinner.email}
                </p>
              </div>
            ) : (
              <p className="text-[13px] text-neutral-500 italic">
                No previous winner yet — this could be the first.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
