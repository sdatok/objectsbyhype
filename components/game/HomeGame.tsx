"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
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
  productImageUrls: string[];
  leaderboard: PublicScore[];
  lastWinner: PublicScore | null;
}

type Phase = "idle" | "playing" | "gameOver" | "submitted";

const POINTS_PER_TASK = 10;
const WRONG_TAP_PENALTY = 2;

// Game tuning — short, intense rounds. Difficulty ramps fast so even good
// players cap out around the 45-60s mark.
const ROUND_MAX_SECONDS = 60;
const INITIAL_SPAWN_MS = 1700;
const SPAWN_DECAY_MS_PER_SEC = 38;
const MIN_SPAWN_MS = 480;
// Task drops live for at most ~4s at the start, ramping down toward MIN.
const MAX_TASK_MS = 4000;
const TASK_DECAY_MS_PER_SEC = 120;
const MIN_TASK_MS = 1100;

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
  const [expanded, setExpanded] = useState(false);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [tasks, setTasks] = useState<ActiveTask[]>([]);
  const [characterAt, setCharacterAt] = useState<StationId>("packing");
  const [flashStation, setFlashStation] = useState<StationId | null>(null);
  const [cameraFlash, setCameraFlash] = useState(false);
  const [remaining, setRemaining] = useState<RemainingTime>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    expired: false,
  });
  const startedAtRef = useRef<number>(0);
  const lastSpawnRef = useRef<number>(0);
  const nextTaskIdRef = useRef<number>(0);
  const nextImageIdxRef = useRef<number>(0);
  const elapsedSecondsRef = useRef<number>(0);

  // Submission UI
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!state) return;
    const endsAt = new Date(state.windowEndsAt).getTime();
    setRemaining(computeRemaining(endsAt));
    const id = window.setInterval(() => {
      const next = computeRemaining(endsAt);
      setRemaining(next);
      if (next.expired) {
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

      const elapsedSec = (now - startedAtRef.current) / 1000;
      elapsedSecondsRef.current = Math.floor(elapsedSec);

      // Hard cap — every round ends at ROUND_MAX_SECONDS regardless of misses.
      if (elapsedSec >= ROUND_MAX_SECONDS) {
        queueMicrotask(() => setPhase("gameOver"));
        return;
      }

      // Spawn cadence shrinks quickly so the game gets harder fast.
      const baseSpawn = Math.max(
        MIN_SPAWN_MS,
        INITIAL_SPAWN_MS / cfg.gameSpeed - elapsedSec * SPAWN_DECAY_MS_PER_SEC
      );

      if (now - lastSpawnRef.current > baseSpawn) {
        const occupied = new Set(tasksRef.current.map((t) => t.stationId));
        const free = STATION_IDS.filter((s) => !occupied.has(s));
        if (free.length > 0) {
          const station = free[Math.floor(Math.random() * free.length)];
          // Drop lifetime: cap at MAX_TASK_MS regardless of admin config,
          // then decay rapidly toward MIN_TASK_MS as the round progresses.
          const baseMs = Math.min(MAX_TASK_MS, cfg.taskBaseSeconds * 1000);
          const decayed = Math.max(
            MIN_TASK_MS,
            baseMs - elapsedSec * TASK_DECAY_MS_PER_SEC
          );
          const id = `t${nextTaskIdRef.current++}`;
          const imageIndex = nextImageIdxRef.current++;
          const newTask: ActiveTask = {
            id,
            stationId: station,
            imageIndex,
            spawnedAt: now,
            expiresAt: now + decayed,
          };
          setTasks((prev) => [...prev, newTask]);
          lastSpawnRef.current = now;
        }
      }

      const expired = tasksRef.current.filter((t) => t.expiresAt <= now);
      if (expired.length > 0) {
        setTasks((prev) => prev.filter((t) => t.expiresAt > now));
        setMisses((prev) => {
          const next = prev + expired.length;
          if (next >= (stateRef.current?.maxMisses ?? 3)) {
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
    setCameraFlash(false);
    setSubmitError(null);
    nextTaskIdRef.current = 0;
    nextImageIdxRef.current = 0;
    startedAtRef.current = performance.now();
    lastSpawnRef.current = performance.now() - 200;
    elapsedSecondsRef.current = 0;
    setPhase("playing");
  }

  const handleStationClick = useCallback((id: StationId) => {
    if (phaseRef.current !== "playing") return;
    setCharacterAt(id);
    // Camera-station click always pops a "flash" — even on a wrong tap,
    // because that's what you'd see if a phone shutter fired in an empty frame.
    if (id === "camera") {
      setCameraFlash(true);
      window.setTimeout(() => setCameraFlash(false), 180);
    }
    const hit = tasksRef.current.find((t) => t.stationId === id);
    if (hit) {
      setTasks((prev) => prev.filter((t) => t.id !== hit.id));
      setScore((s) => s + POINTS_PER_TASK);
      setFlashStation(id);
      window.setTimeout(
        () => setFlashStation((f) => (f === id ? null : f)),
        220
      );
    } else {
      setScore((s) => Math.max(0, s - WRONG_TAP_PENALTY));
    }
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phaseRef.current !== "playing") return;
      if (e.key === "1") handleStationClick("computer");
      else if (e.key === "2") handleStationClick("packing");
      else if (e.key === "3") handleStationClick("camera");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleStationClick]);

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

  function toggleExpanded() {
    setExpanded((current) => {
      const next = !current;
      // Collapsing mid-round? Reset cleanly so we don't keep the game loop
      // ticking against an unmounted 3D scene.
      if (!next && phase === "playing") {
        setPhase("idle");
        setTasks([]);
        setScore(0);
        setMisses(0);
      }
      return next;
    });
  }

  if (stateError) {
    return (
      <section className="bg-white px-4 py-8 text-center font-pixel text-[10px] text-neutral-500">
        {stateError}
      </section>
    );
  }
  if (!state) {
    return (
      <section className="bg-white px-4 py-12 text-center font-pixel text-[10px] text-neutral-400">
        LOADING…
      </section>
    );
  }
  if (!state.enabled) {
    return null;
  }

  return (
    <section
      aria-label="OBH Giveaway Game"
      className="relative overflow-hidden bg-white text-black"
    >
      {/* Soft purple glow at the top so the page doesn't feel sterile */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-32 h-64 blur-3xl opacity-40"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 50%, rgba(232,121,249,0.35), transparent 70%)",
        }}
      />

      <div className="relative max-w-[1600px] mx-auto px-3 sm:px-4 py-6 md:py-10">
        {/* COLLAPSIBLE TAB HEADER — clicking expands the game.
            On mobile, the prize and countdown stack; on desktop they sit side-by-side. */}
        <button
          type="button"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-controls="obh-game-body"
          className="w-full text-left border-2 border-black bg-white hover:bg-fuchsia-50 active:bg-fuchsia-100 transition-colors px-4 py-4 sm:py-5"
          style={{ boxShadow: expanded ? "0 0 0 #000" : "5px 5px 0 #000" }}
        >
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div className="min-w-0">
              <p className="font-pixel text-[9px] sm:text-[10px] text-fuchsia-600">
                HOURLY GIVEAWAY
              </p>
              <h2 className="font-pixel text-black text-[18px] sm:text-[24px] md:text-[30px] leading-[1.25] mt-2 break-words">
                {state.prizeTitle}
              </h2>
              {state.prizeDescription && expanded && (
                <p className="font-pixel-body text-[18px] sm:text-[20px] text-neutral-700 mt-2 max-w-md leading-snug">
                  {state.prizeDescription}
                </p>
              )}
            </div>
            <div className="flex items-end gap-4 md:gap-5">
              <div className="text-left md:text-right">
                <p className="font-pixel text-[9px] sm:text-[10px] text-fuchsia-600">
                  NEXT WINNER IN
                </p>
                <p
                  className="font-pixel text-black text-[22px] sm:text-[30px] md:text-[36px] leading-none mt-1 tabular-nums"
                  style={{
                    textShadow:
                      "2px 2px 0 rgba(232,121,249,0.35), 4px 4px 0 rgba(124,58,237,0.18)",
                  }}
                >
                  {pad(remaining.hours)}:{pad(remaining.minutes)}:
                  {pad(remaining.seconds)}
                </p>
              </div>
              {/* Open/close chevron + label */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <span
                  aria-hidden
                  className="font-pixel text-[20px] text-fuchsia-600 leading-none transition-transform"
                  style={{
                    transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                    display: "inline-block",
                  }}
                >
                  ▼
                </span>
                <span className="font-pixel text-[8px] text-fuchsia-600 hidden sm:block">
                  {expanded ? "CLOSE" : "PLAY"}
                </span>
              </div>
            </div>
          </div>
        </button>

        {/* Collapsed-state helper text under the tab */}
        {!expanded && (
          <p className="font-pixel-body text-[18px] text-neutral-600 mt-3 text-center">
            Tap the bar above to play for{" "}
            <span className="text-fuchsia-700 font-bold">
              {state.prizeTitle}
            </span>
          </p>
        )}

        {/* EXPANDED BODY — only here do we mount the heavy 3D canvas + everything else */}
        <div
          id="obh-game-body"
          hidden={!expanded}
          className="mt-5 sm:mt-6"
        >
          {expanded && (
            <>
              {/* HUD: score / misses / start */}
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div className="flex items-center gap-5 sm:gap-6">
                  <div>
                    <p className="font-pixel text-[9px] text-fuchsia-600">SCORE</p>
                    <p className="font-pixel text-[18px] sm:text-[20px] tabular-nums text-black mt-1">
                      {score.toString().padStart(4, "0")}
                    </p>
                  </div>
                  <div>
                    <p className="font-pixel text-[9px] text-fuchsia-600">MISSES</p>
                    <p className="font-pixel text-[18px] sm:text-[20px] tabular-nums mt-1">
                      <span className="text-black">{misses}</span>
                      <span className="text-neutral-400">
                        {" "}
                        / {state.maxMisses}
                      </span>
                    </p>
                  </div>
                </div>
                {phase === "idle" && (
                  <button
                    type="button"
                    onClick={startGame}
                    className="font-pixel text-[11px] px-5 sm:px-6 py-3 min-h-[48px] text-white border-2 border-black transition-transform hover:scale-[1.03] active:translate-y-[2px]"
                    style={{
                      background:
                        "linear-gradient(135deg, #c026d3 0%, #7c3aed 100%)",
                      boxShadow: "4px 4px 0 #000",
                    }}
                  >
                    PLAY TO WIN
                  </button>
                )}
                {phase === "playing" && (
                  <button
                    type="button"
                    onClick={() => setPhase("gameOver")}
                    className="font-pixel text-[10px] px-4 py-3 min-h-[44px] text-black border-2 border-black bg-white hover:bg-black hover:text-white transition-colors"
                  >
                    END ROUND
                  </button>
                )}
              </div>

              {/* 3D canvas */}
              <div
                className="relative w-full overflow-hidden border-2 border-black h-[44vh] sm:h-[48vh] md:h-[54vh] min-h-[320px] bg-white"
                style={{ boxShadow: "6px 6px 0 #000" }}
              >
                <GameScene
                  tasks={tasks}
                  characterAt={characterAt}
                  flashStation={flashStation}
                  cameraFlash={cameraFlash}
                  productImageUrls={state.productImageUrls}
                  onStationClick={handleStationClick}
                />

                {/* Station name labels */}
                <div className="absolute inset-x-0 bottom-2 px-3 pointer-events-none">
                  <div className="grid grid-cols-3 gap-2 text-center justify-items-center">
                    {STATION_IDS.map((id, i) => (
                      <div
                        key={id}
                        className="font-pixel text-[11px] sm:text-[14px] text-black bg-white/90 backdrop-blur-sm px-1.5 py-0.5 border border-black/30 inline-block"
                      >
                        <span className="hidden sm:inline text-fuchsia-600">
                          {i + 1}·
                        </span>{" "}
                        {STATION_LABELS[id]}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Touch buttons for mobile while playing */}
                {phase === "playing" && (
                  <div className="absolute inset-x-0 bottom-10 px-3 md:hidden pointer-events-none">
                    <div className="grid grid-cols-3 gap-2">
                      {STATION_IDS.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => handleStationClick(id)}
                          className="pointer-events-auto min-h-[48px] font-pixel text-[9px] text-black border-2 border-black bg-white/90 active:bg-fuchsia-200 transition-colors"
                          style={{ boxShadow: "3px 3px 0 #000" }}
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
                        "linear-gradient(to top, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.55) 45%, transparent 100%)",
                    }}
                  >
                    <div className="pb-10 px-4 text-center max-w-md">
                      <p className="font-pixel text-[10px] text-fuchsia-600">
                        HOW TO PLAY
                      </p>
                      <p className="font-pixel-body text-[18px] sm:text-[20px] text-black mt-3 leading-snug">
                        Run the OBH ops desk. Tap a station the second a drop
                        lands: <span className="text-fuchsia-600">LIST IT</span>
                        , <span className="text-violet-600">PACK IT</span>, or{" "}
                        <span className="text-pink-600">SHOOT IT</span>. Miss{" "}
                        {state.maxMisses} and you&apos;re out — top score wins.
                      </p>
                      <p className="font-pixel text-[8px] text-fuchsia-600 mt-4">
                        DESKTOP: PRESS 1 / 2 / 3
                      </p>
                    </div>
                  </div>
                )}

                {/* Game over modal */}
                {phase === "gameOver" && (
                  <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <form
                      onSubmit={submitScore}
                      className="w-full max-w-sm space-y-4 my-auto"
                    >
                      <div className="text-center">
                        <p className="font-pixel text-[10px] text-fuchsia-600">
                          ROUND OVER
                        </p>
                        <p
                          className="font-pixel text-[36px] sm:text-[40px] tabular-nums text-black mt-2"
                          style={{
                            textShadow:
                              "3px 3px 0 rgba(232,121,249,0.5), 6px 6px 0 rgba(124,58,237,0.2)",
                          }}
                        >
                          {score.toString().padStart(4, "0")}
                        </p>
                        <p className="font-pixel-body text-[18px] text-neutral-700 mt-2 leading-snug">
                          Submit to be eligible for{" "}
                          <span className="text-fuchsia-700 font-bold">
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
                        className="w-full bg-white border-2 border-black px-3 py-3 min-h-[48px] text-base text-black placeholder-neutral-400 focus:outline-none focus:border-fuchsia-500 transition-colors font-pixel-body text-[18px]"
                      />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Display name (optional)"
                        maxLength={32}
                        className="w-full bg-white border-2 border-black px-3 py-3 min-h-[48px] text-base text-black placeholder-neutral-400 focus:outline-none focus:border-fuchsia-500 transition-colors font-pixel-body text-[18px]"
                      />
                      {submitError && (
                        <p className="font-pixel text-[10px] text-rose-600">
                          {submitError}
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full font-pixel text-[11px] px-5 py-3 min-h-[48px] text-white border-2 border-black disabled:opacity-50"
                        style={{
                          background:
                            "linear-gradient(135deg, #c026d3 0%, #7c3aed 100%)",
                          boxShadow: "4px 4px 0 #000",
                        }}
                      >
                        {submitting ? "SUBMITTING…" : "SUBMIT SCORE"}
                      </button>
                      <button
                        type="button"
                        onClick={startGame}
                        className="w-full font-pixel text-[10px] text-black border-2 border-black bg-white px-5 py-3 min-h-[44px] hover:bg-black hover:text-white transition-colors"
                      >
                        PLAY AGAIN
                      </button>
                    </form>
                  </div>
                )}

                {/* Submitted */}
                {phase === "submitted" && (
                  <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="text-center max-w-sm space-y-3 text-black">
                      <p className="font-pixel text-[10px] text-fuchsia-600">
                        SUBMITTED
                      </p>
                      <p
                        className="font-pixel text-[28px] sm:text-[32px] tabular-nums"
                        style={{
                          textShadow:
                            "3px 3px 0 rgba(232,121,249,0.5), 6px 6px 0 rgba(124,58,237,0.2)",
                        }}
                      >
                        {score.toString().padStart(4, "0")}
                      </p>
                      <p className="font-pixel-body text-[18px] text-neutral-700 leading-snug">
                        If your score is highest when the countdown hits zero,
                        we&apos;ll email you about{" "}
                        <span className="text-fuchsia-700 font-bold">
                          {state.prizeTitle}
                        </span>
                        .
                      </p>
                      <button
                        type="button"
                        onClick={startGame}
                        className="font-pixel text-[11px] px-6 py-3 min-h-[48px] text-white border-2 border-black"
                        style={{
                          background:
                            "linear-gradient(135deg, #c026d3 0%, #7c3aed 100%)",
                          boxShadow: "4px 4px 0 #000",
                        }}
                      >
                        TRY AGAIN
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Leaderboard + last winner */}
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <p className="font-pixel text-[10px] text-fuchsia-600 mb-3">
                    THIS WINDOW&apos;S LEADERBOARD
                  </p>
                  {state.leaderboard.length === 0 ? (
                    <p className="font-pixel-body text-[18px] text-neutral-500">
                      No scores yet. Be the first.
                    </p>
                  ) : (
                    <ol className="space-y-2">
                      {state.leaderboard.slice(0, 5).map((s, i) => (
                        <li
                          key={`${s.email}-${s.createdAt}`}
                          className="flex items-center justify-between border-b-2 border-black/10 pb-2"
                        >
                          <span className="flex items-center gap-3 min-w-0">
                            <span className="font-pixel text-[10px] text-fuchsia-600 w-5">
                              {i + 1}
                            </span>
                            <span className="font-pixel-body text-[18px] text-black truncate">
                              {s.displayName || s.email.split("@")[0]}
                            </span>
                          </span>
                          <span className="font-pixel text-[12px] tabular-nums text-black shrink-0">
                            {s.score.toString().padStart(4, "0")}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <div>
                  <p className="font-pixel text-[10px] text-fuchsia-600 mb-3">
                    LAST WINDOW&apos;S WINNER
                  </p>
                  {state.lastWinner ? (
                    <div className="text-black">
                      <p className="font-pixel text-[14px]">
                        {state.lastWinner.displayName ||
                          state.lastWinner.email.split("@")[0]}
                      </p>
                      <p className="font-pixel-body text-[18px] text-neutral-700 mt-1">
                        Score{" "}
                        <span className="font-pixel text-[12px] tabular-nums text-fuchsia-700">
                          {state.lastWinner.score}
                        </span>
                      </p>
                      <p className="font-pixel-body text-[16px] text-neutral-500 mt-1">
                        {state.lastWinner.email}
                      </p>
                    </div>
                  ) : (
                    <p className="font-pixel-body text-[18px] text-neutral-500">
                      No previous winner yet — this could be the first.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
