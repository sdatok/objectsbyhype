"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "colyseus.js";
import { startInputLoop, type MutableInput } from "@/lib/survivor-client";

/**
 * The actual top-down 2D game. Reads room.state every animation frame and
 * draws a fresh world snapshot to the canvas. Inputs are captured imperatively
 * and pushed to the server at 30Hz from lib/survivor-client.ts.
 *
 * v1 keeps it simple:
 *   - desktop only (WASD + mouse)
 *   - no client-side prediction or interpolation (server-authoritative,
 *     direct render)
 *   - circle players with display-name labels
 *   - shrinking safe-zone shown as a dashed ring
 *   - HUD: HP, kills, alive count, match phase + remaining time
 */

interface GameCanvasProps {
  room: Room;
  onLeave: () => void;
}

interface ServerPlayer {
  email: string;
  displayName: string;
  x: number;
  y: number;
  aim: number;
  hp: number;
  kills: number;
  alive: boolean;
  connected: boolean;
  deathAt: number;
  placement: number;
}

interface ServerBullet {
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spawnedAt: number;
}

interface ServerZone {
  cx: number;
  cy: number;
  radius: number;
  targetRadius: number;
}

interface ServerState {
  status: "WAITING" | "COUNTDOWN" | "PLAYING" | "ENDED";
  matchId: string;
  prizeTitle: string;
  startedAtMs: number;
  endedAtMs: number;
  countdownEndsAtMs: number;
  matchEndsAtMs: number;
  players: Map<string, ServerPlayer> | { forEach: (cb: (p: ServerPlayer, k: string) => void) => void; size: number };
  bullets: ServerBullet[] | { forEach: (cb: (b: ServerBullet) => void) => void; length: number };
  zone: ServerZone;
}

// World units; should match game-server/src/constants.ts WORLD_SIZE.
const WORLD = 1600;
const PLAYER_R = 18;
const BULLET_R = 4;

export default function GameCanvas({ room, onLeave }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<MutableInput>({
    moveX: 0,
    moveY: 0,
    aim: 0,
    shooting: false,
  });

  // Keys currently pressed, drives input.moveX/moveY.
  const keysRef = useRef<Set<string>>(new Set());
  // Last mouse client coords, used to recompute aim each frame.
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // Track our session id once we have it.
  const sessionIdRef = useRef<string>(room.sessionId);

  // Status sampled at React rate so the HUD/result modal re-render.
  const [statusSnapshot, setStatusSnapshot] = useState<{
    status: ServerState["status"];
    aliveCount: number;
    selfAlive: boolean;
    selfHp: number;
    selfKills: number;
    selfPlacement: number;
    matchEndsAtMs: number;
    countdownEndsAtMs: number;
    startedAtMs: number;
  }>(() => snapshotStatus(room));

  useEffect(() => {
    sessionIdRef.current = room.sessionId;
  }, [room]);

  // Subscribe to broad state changes for the HUD only. The hot path (drawing)
  // reads room.state directly inside rAF.
  useEffect(() => {
    const cb = () => {
      setStatusSnapshot(snapshotStatus(room));
    };
    room.onStateChange(cb);
    return () => {
      room.onStateChange.remove(cb);
    };
  }, [room]);

  // 30Hz input loop.
  useEffect(() => {
    return startInputLoop(room, inputRef, 1000 / 30);
  }, [room]);

  // Resize canvas to its container while keeping a DPR-aware backing store.
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  // Keyboard handlers: WASD + arrows.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysRef.current.add(k);
      if (k === " " || k === "w" || k === "a" || k === "s" || k === "d") {
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };
    const onBlur = () => keysRef.current.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // Render loop + input derivation.
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) {
        raf = window.requestAnimationFrame(draw);
        return;
      }

      // Update input vector from keys for the next /input send.
      const k = keysRef.current;
      const moveX = (k.has("d") || k.has("arrowright") ? 1 : 0) +
        (k.has("a") || k.has("arrowleft") ? -1 : 0);
      const moveY = (k.has("s") || k.has("arrowdown") ? 1 : 0) +
        (k.has("w") || k.has("arrowup") ? -1 : 0);
      const len = Math.hypot(moveX, moveY) || 1;
      inputRef.current.moveX = moveX / len;
      inputRef.current.moveY = moveY / len;

      const rs = room.state as unknown as ServerState;
      const self = lookupPlayer(rs, sessionIdRef.current);

      // Aim: mouse position relative to self in world space.
      if (self) {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const camX = self.x;
        const camY = self.y;
        // Convert from CSS coords to world coords using same scale as render.
        const scale = computeWorldScale(rect.width, rect.height);
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const wx = (mouseRef.current.x - rect.left - cx) / scale + camX;
        const wy = (mouseRef.current.y - rect.top - cy) / scale + camY;
        inputRef.current.aim = Math.atan2(wy - self.y, wx - self.x);
        void dpr;
      }

      renderFrame(ctx, canvas, rs, sessionIdRef.current);

      raf = window.requestAnimationFrame(draw);
    };
    raf = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(raf);
  }, [room]);

  // Mouse handlers on the canvas.
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    mouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) inputRef.current.shooting = true;
  }, []);
  const onMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) inputRef.current.shooting = false;
  }, []);
  const onContextMenu = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
    },
    []
  );

  return (
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden bg-neutral-950 select-none"
      style={{ minHeight: "60vh" }}
    >
      <canvas
        ref={canvasRef}
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onContextMenu={onContextMenu}
        className="block w-full h-full cursor-crosshair"
      />

      <Hud snapshot={statusSnapshot} onLeave={onLeave} />
    </div>
  );
}

// ============================================================
// HUD
// ============================================================

function Hud(props: {
  snapshot: ReturnType<typeof snapshotStatus>;
  onLeave: () => void;
}) {
  const { snapshot, onLeave } = props;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, []);
  void tick;

  let timerText = "";
  if (snapshot.status === "COUNTDOWN" && snapshot.countdownEndsAtMs) {
    const left = Math.max(0, snapshot.countdownEndsAtMs - Date.now());
    timerText = `Starts in ${Math.ceil(left / 1000)}s`;
  } else if (snapshot.status === "PLAYING" && snapshot.matchEndsAtMs) {
    const left = Math.max(0, snapshot.matchEndsAtMs - Date.now());
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    timerText = `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <>
      <div className="absolute inset-x-0 top-0 px-4 py-3 flex items-center justify-between gap-3 pointer-events-none">
        <div className="flex items-center gap-4 sm:gap-6 text-xs">
          <Stat label="HP" value={snapshot.selfAlive ? Math.ceil(snapshot.selfHp).toString() : "DEAD"} />
          <Stat label="KILLS" value={snapshot.selfKills.toString()} />
          <Stat label="ALIVE" value={snapshot.aliveCount.toString()} />
        </div>
        <div className="text-right">
          <p className="text-[9px] uppercase tracking-[0.25em] text-fuchsia-300">
            {snapshot.status}
          </p>
          {timerText && (
            <p className="text-xl font-bold tabular-nums mt-0.5">{timerText}</p>
          )}
        </div>
      </div>

      {snapshot.status === "ENDED" && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 pointer-events-auto">
          <div className="max-w-md text-center space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-400">
              Match over
            </p>
            <h2 className="text-3xl font-bold">
              {snapshot.selfPlacement === 1
                ? "You won."
                : snapshot.selfPlacement === 0
                ? "Match complete."
                : `Placement #${snapshot.selfPlacement}`}
            </h2>
            <p className="text-sm text-neutral-400">
              We&apos;ll email the winner. Thanks for playing.
            </p>
            <button
              type="button"
              onClick={onLeave}
              className="text-xs tracking-widest uppercase px-5 py-3 border border-white hover:bg-white hover:text-black transition-colors"
            >
              Back to lobby
            </button>
          </div>
        </div>
      )}

      {snapshot.status === "COUNTDOWN" && (
        <div className="absolute inset-x-0 bottom-6 flex justify-center pointer-events-none">
          <p className="text-xs uppercase tracking-[0.25em] text-neutral-400 bg-black/60 px-4 py-2 border border-white/10">
            Waiting for host to start · {snapshot.aliveCount}/25 in arena
          </p>
        </div>
      )}

      {snapshot.status === "PLAYING" && !snapshot.selfAlive && (
        <div className="absolute inset-x-0 bottom-6 flex justify-center pointer-events-none">
          <p className="text-xs uppercase tracking-[0.25em] text-rose-400 bg-black/60 px-4 py-2 border border-rose-400/30">
            Spectating
          </p>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.25em] text-fuchsia-300">
        {label}
      </p>
      <p className="text-lg font-bold tabular-nums leading-none mt-0.5">
        {value}
      </p>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function lookupPlayer(
  state: ServerState,
  sessionId: string
): ServerPlayer | null {
  const players = state.players as unknown as {
    get?: (k: string) => ServerPlayer | undefined;
    forEach: (cb: (p: ServerPlayer, k: string) => void) => void;
  };
  if (typeof players.get === "function") {
    return players.get(sessionId) ?? null;
  }
  let found: ServerPlayer | null = null;
  players.forEach((p, k) => {
    if (!found && k === sessionId) found = p;
  });
  return found;
}

function snapshotStatus(room: Room) {
  const rs = room.state as unknown as ServerState;
  let aliveCount = 0;
  rs.players.forEach((p: ServerPlayer) => {
    if (p.alive) aliveCount++;
  });
  const self = lookupPlayer(rs, room.sessionId);
  return {
    status: rs.status,
    aliveCount,
    selfAlive: self?.alive ?? false,
    selfHp: self?.hp ?? 0,
    selfKills: self?.kills ?? 0,
    selfPlacement: self?.placement ?? 0,
    matchEndsAtMs: rs.matchEndsAtMs,
    countdownEndsAtMs: rs.countdownEndsAtMs,
    startedAtMs: rs.startedAtMs,
  };
}

/** Choose a uniform world->screen scale that fits the world inside the
 *  viewport's smaller axis with a margin so the camera can pan. */
function computeWorldScale(cssW: number, cssH: number): number {
  // We render the world centered on the player; show ~1100 units across the
  // smaller axis for a comfortable visual radius.
  const viewSpan = 1100;
  return Math.min(cssW, cssH) / viewSpan;
}

function renderFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  rs: ServerState,
  selfId: string
) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.width / dpr;
  const cssH = canvas.height / dpr;

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, cssW, cssH);

  const self = lookupPlayer(rs, selfId);
  const camX = self?.x ?? 0;
  const camY = self?.y ?? 0;
  const scale = computeWorldScale(cssW, cssH);
  const cx = cssW / 2;
  const cy = cssH / 2;

  const w2s = (x: number, y: number) => ({
    sx: (x - camX) * scale + cx,
    sy: (y - camY) * scale + cy,
  });

  // World grid for spatial sense.
  drawGrid(ctx, w2s, cssW, cssH, scale);

  // World boundary box.
  const tl = w2s(-WORLD / 2, -WORLD / 2);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.strokeRect(tl.sx, tl.sy, WORLD * scale, WORLD * scale);

  // Safe zone (dashed circle).
  const zc = w2s(rs.zone.cx, rs.zone.cy);
  ctx.strokeStyle = "rgba(192,38,211,0.65)";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(zc.sx, zc.sy, rs.zone.radius * scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Bullets.
  ctx.fillStyle = "#fde047";
  (rs.bullets as unknown as { forEach: (cb: (b: ServerBullet) => void) => void }).forEach(
    (b) => {
      const p = w2s(b.x, b.y);
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, Math.max(2, BULLET_R * scale), 0, Math.PI * 2);
      ctx.fill();
    }
  );

  // Players.
  rs.players.forEach((p: ServerPlayer, sessionId: string) => {
    const isSelf = sessionId === selfId;
    const s = w2s(p.x, p.y);
    const r = PLAYER_R * scale;

    if (!p.alive) {
      ctx.globalAlpha = 0.25;
    }

    // Body
    ctx.fillStyle = isSelf ? "#22d3ee" : "#f0abfc";
    ctx.beginPath();
    ctx.arc(s.sx, s.sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = isSelf ? "#0e7490" : "#a21caf";
    ctx.stroke();

    // Gun barrel
    if (p.alive) {
      ctx.strokeStyle = isSelf ? "#0e7490" : "#7c3aed";
      ctx.lineWidth = Math.max(2, 4 * scale);
      ctx.beginPath();
      ctx.moveTo(s.sx, s.sy);
      ctx.lineTo(
        s.sx + Math.cos(p.aim) * (r + 10),
        s.sy + Math.sin(p.aim) * (r + 10)
      );
      ctx.stroke();
    }

    // HP bar above
    if (p.alive) {
      const barW = Math.max(28, r * 2.1);
      const barH = 5;
      const bx = s.sx - barW / 2;
      const by = s.sy - r - 12;
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = p.hp > 40 ? "#34d399" : p.hp > 15 ? "#fbbf24" : "#f87171";
      ctx.fillRect(bx, by, barW * Math.max(0, Math.min(1, p.hp / 100)), barH);
    }

    // Display name
    ctx.globalAlpha = p.alive ? 0.85 : 0.35;
    ctx.fillStyle = "#ffffff";
    ctx.font = `${Math.max(10, 12 * Math.min(1.5, scale))}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(p.displayName, s.sx, s.sy - r - 18);

    ctx.globalAlpha = 1;
  });

  ctx.restore();
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  w2s: (x: number, y: number) => { sx: number; sy: number },
  cssW: number,
  cssH: number,
  scale: number
) {
  void cssW;
  void cssH;
  const step = 200; // world units between grid lines
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -WORLD / 2; x <= WORLD / 2; x += step) {
    const a = w2s(x, -WORLD / 2);
    const b = w2s(x, WORLD / 2);
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
  }
  for (let y = -WORLD / 2; y <= WORLD / 2; y += step) {
    const a = w2s(-WORLD / 2, y);
    const b = w2s(WORLD / 2, y);
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
  }
  ctx.stroke();
  void scale;
}
