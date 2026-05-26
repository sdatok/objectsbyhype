import type { GameConfig } from "@prisma/client";

/** Mirrors client constants in HomeGame.tsx */
const BASE_POINTS = 10;
const STREAK_BONUS = 2;
const STREAK_CAP = 30;
const INITIAL_SPAWN_MS = 1250;
const SPAWN_DECAY_MS_PER_SEC = 55;
const MIN_SPAWN_MS = 340;

export interface TapStatsPayload {
  total?: number;
  wrong?: number;
  minIntervalMs?: number;
  intervalCV?: number;
  trusted?: number;
  untrusted?: number;
}

export interface AnticheatConfig {
  gameSpeed: number;
}

/** Perfect-play upper bound for a round of `secondsPlayed` (ms-resolution sim). */
export function maxPlausibleScore(
  secondsPlayed: number,
  gameSpeed: number
): number {
  const seconds = Math.max(0, Math.floor(secondsPlayed));
  if (seconds === 0) return 0;

  let t = 0;
  let score = 0;
  let streak = 0;
  let lastSpawn = 0;
  let active = 0;
  const end = seconds * 1000;

  while (t < end) {
    const elapsedSec = t / 1000;
    const spawnMs = Math.max(
      MIN_SPAWN_MS,
      INITIAL_SPAWN_MS / Math.max(0.1, gameSpeed) -
        elapsedSec * SPAWN_DECAY_MS_PER_SEC
    );

    if (active > 0) {
      score += BASE_POINTS + Math.min(STREAK_CAP, streak * STREAK_BONUS);
      streak += 1;
      active -= 1;
    }

    if (active < 3 && t >= lastSpawn + spawnMs) {
      active += 1;
      lastSpawn = t;
    }

    t += 1;
  }

  return score;
}

/** Smallest whole-second duration that could produce `score` under perfect play. */
export function minPlausibleSecondsForScore(
  score: number,
  gameSpeed: number
): number {
  if (score <= 0) return 0;
  let lo = 1;
  let hi = 60 * 60;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (maxPlausibleScore(mid, gameSpeed) >= score) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** Minimum tap count implied by score (assumes near-perfect streak hits). */
export function minTapsForScore(score: number): number {
  if (score <= 0) return 0;
  const maxPerHit = BASE_POINTS + STREAK_CAP;
  return Math.ceil(score / maxPerHit);
}

const SCORE_TOLERANCE = 1.08; // 8% over perfect-play simulation
const TIME_TOLERANCE = 0.92; // reported time may be slightly low vs wall clock

export function validateScorePlausibility(
  score: number,
  secondsPlayed: number,
  gameSpeed: number
): string | null {
  const ceiling = maxPlausibleScore(secondsPlayed, gameSpeed);
  if (score > ceiling * SCORE_TOLERANCE) {
    return "Score is too high for how long that round lasted.";
  }

  const minSeconds = minPlausibleSecondsForScore(score, gameSpeed);
  if (secondsPlayed < minSeconds * TIME_TOLERANCE) {
    return "Round duration is too short for that score.";
  }

  return null;
}

export function validateTapStats(
  score: number,
  secondsPlayed: number,
  stats: TapStatsPayload
): string | null {
  const totalTaps = Math.floor(Number(stats.total ?? 0));
  const wrongTaps = Math.floor(Number(stats.wrong ?? 0));
  const minIntervalMs = Number(stats.minIntervalMs ?? Infinity);
  const intervalCV = Number(stats.intervalCV ?? 1);
  const trusted = Math.floor(Number(stats.trusted ?? 0));
  const untrusted = Math.floor(Number(stats.untrusted ?? 0));

  if (score >= 500 && totalTaps <= 0) {
    return "Missing tap data — play the round in your browser and submit again.";
  }

  const minTaps = minTapsForScore(score);
  const correctTaps = Math.max(0, totalTaps - wrongTaps);
  if (totalTaps > 0 && correctTaps + 2 < minTaps) {
    return "Tap count is too low for that score.";
  }

  if (totalTaps >= 8) {
    if (wrongTaps / Math.max(1, totalTaps) > 0.7) {
      return "Too many wrong taps — looks automated.";
    }
    if (Number.isFinite(minIntervalMs) && minIntervalMs < 45) {
      return "Tap rate is faster than humanly possible.";
    }
    if (Number.isFinite(intervalCV) && intervalCV < 0.06) {
      return "Tap timing is too uniform.";
    }
  }

  const inputEvents = trusted + untrusted;
  if (score >= 8000 && inputEvents > 0) {
    if (trusted / inputEvents < 0.95) {
      return "Round used non-human input — play in the browser without scripts.";
    }
  }

  if (totalTaps >= 20 && secondsPlayed > 0) {
    // Spawn cadence caps throughput — can't register more taps than time allows.
    const maxTapsPerSecond = 1000 / MIN_SPAWN_MS + 0.5;
    if (totalTaps > secondsPlayed * maxTapsPerSecond * 1.25) {
      return "Too many taps for the length of that round.";
    }
  }

  return null;
}

export function anticheatFromConfig(config: Pick<GameConfig, "gameSpeed">): AnticheatConfig {
  return { gameSpeed: config.gameSpeed };
}
