/**
 * Tuning constants for the Survivor game server. Everything here is server-
 * authoritative — change the value, redeploy, and the new behavior takes
 * effect on the next match.
 */

// ---------- World ----------
export const WORLD_SIZE = 1600;
export const WORLD_HALF = WORLD_SIZE / 2;

// ---------- Tick ----------
/** Simulation runs at 30Hz; one tick every ~33ms. */
export const TICK_MS = 1000 / 30;

// ---------- Player ----------
export const PLAYER_RADIUS = 18;
export const PLAYER_MAX_HP = 100;
export const PLAYER_SPEED = 280; // units / sec

// ---------- Gun ----------
export const BULLET_DAMAGE = 25;
export const BULLET_SPEED = 800; // units / sec
export const BULLET_RADIUS = 4;
/** Lifetime in seconds before a bullet vanishes. */
export const BULLET_TTL_SEC = 1.5;
/** Minimum gap between shots in milliseconds. */
export const SHOT_COOLDOWN_MS = 400;

// ---------- Zone ----------
export const ZONE_START_RADIUS = 1100;
export const ZONE_END_RADIUS = 120;
/** Damage per second when outside the safe zone. Ramps up over the match. */
export const ZONE_DPS_START = 4;
export const ZONE_DPS_END = 25;

// ---------- Match ----------
/** Default match length in seconds; overridable by admin start payload. */
export const DEFAULT_MATCH_SECONDS = 420;
/** Default lobby seconds (between admin-start and PLAYING). Players who join
 *  during this window spawn as active; admin can override per-match. */
export const DEFAULT_LOBBY_SECONDS = 60;
export const MAX_PLAYERS = 25;

// ---------- Anti-cheat ----------
/** Max input messages per second; anything above is dropped silently. */
export const MAX_INPUTS_PER_SEC = 60;
