"use client";

import { useEffect, useRef, useState } from "react";
import type { Room } from "colyseus.js";
import { startRedLightInputLoop, type RedLightInput } from "@/lib/red-light-client";
import {
  RLGL_FINISH_Y,
  RLGL_START_Y,
  RLGL_TRACK_LENGTH,
  RLGL_TRACK_WIDTH,
  rlglRoundTiming,
} from "@/lib/red-light-game-constants";
import { drawSlime } from "@/components/survivor/SlimeAvatar";
import {
  DEFAULT_SLIME_COLOR,
  migrateLegacyAccessories,
  parseNameColor,
  parseSlimeAccessories,
  parseSlimeColor,
  parseSlimeFace,
} from "@/lib/survivor-slime";
import {
  dollTurnProgress,
  drawYoungHeeDoll,
  preloadYoungHeeDoll,
} from "@/components/red-light/RedLightDoll";
import {
  drawPinkGuard,
  drawSquidGameField,
} from "@/components/red-light/RedLightFieldArt";

const PLAYER_R = 15;
const VIEW_W = 960;
const VIEW_H = 1700;
const PERSPECTIVE_Y = 0.74;
const INTERP_MS = 110;

interface PlayerSnap {
  x: number;
  y: number;
  displayName: string;
  alive: boolean;
  slimeColor: string;
  slimeFace: number;
  slimeAccessories: number;
  nameColor: string;
  placement?: number;
  deathAt?: number;
}

interface ServerState {
  status?: string;
  matchEndsAtMs?: number;
  lightPhase?: string;
  roundNumber?: number;
  phaseEndsAtMs?: number;
  startLineY?: number;
  finishLineY?: number;
  trackWidth?: number;
  trackLength?: number;
  players?: {
    forEach?: (cb: (p: PlayerSnap, id: string) => void) => void;
    get?: (id: string) => PlayerSnap | undefined;
  };
}

type PosBuf = Map<string, { prev: { t: number; x: number; y: number }; curr: { t: number; x: number; y: number } }>;

function forEachPlayer(rs: ServerState, cb: (p: PlayerSnap, id: string) => void): void {
  rs.players?.forEach?.(cb);
}

function getPlayer(rs: ServerState, id: string): PlayerSnap | null {
  const players = rs.players;
  if (!players) return null;
  if (typeof players.get === "function") return players.get(id) ?? null;
  let found: PlayerSnap | null = null;
  players.forEach?.((p, sid) => {
    if (!found && sid === id) found = p;
  });
  return found;
}

function interpPos(
  pair: { prev: { t: number; x: number; y: number }; curr: { t: number; x: number; y: number } } | undefined
): { x: number; y: number } | null {
  if (!pair) return null;
  const renderT = Date.now() - INTERP_MS;
  const { prev, curr } = pair;
  if (curr.t <= prev.t) return { x: curr.x, y: curr.y };
  const span = curr.t - prev.t;
  const t = Math.max(0, Math.min(1, (renderT - prev.t) / span));
  return {
    x: prev.x + (curr.x - prev.x) * t,
    y: prev.y + (curr.y - prev.y) * t,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export default function RedLightGameCanvas({
  room,
  onLeave,
}: {
  room: Room;
  onLeave: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<RedLightInput>({ moveX: 0, moveY: 0, forward: false });
  const holdRef = useRef(false);
  const keysRef = useRef({ w: false, space: false, a: false, d: false });
  const camRef = useRef({ x: 0, y: 0, init: false });
  const playerBufRef = useRef<PosBuf>(new Map());
  const phaseFlashRef = useRef(0);
  const lastPhaseRef = useRef("");

  const [eliminated, setEliminated] = useState(false);
  const [finished, setFinished] = useState(false);
  const [placement, setPlacement] = useState(0);
  const [ended, setEnded] = useState(false);
  const [progressPct, setProgressPct] = useState(0);

  useEffect(() => {
    preloadYoungHeeDoll();
  }, []);

  useEffect(() => {
    const syncSelf = () => {
      const rs = room.state as unknown as ServerState;
      const me = getPlayer(rs, room.sessionId);
      if (!me) return;
      if (me.placement && me.placement > 0) {
        setFinished(true);
        setPlacement(me.placement);
      } else if (!me.alive && (me.deathAt ?? 0) > 0) {
        setEliminated(true);
      }
      if (rs.status === "ENDED") setEnded(true);

      const startY = rs.startLineY ?? RLGL_START_Y;
      const finishY = rs.finishLineY ?? RLGL_FINISH_Y;
      const pct = Math.max(0, Math.min(1, (startY - me.y) / (startY - finishY)));
      setProgressPct(pct);

      const phase = rs.lightPhase ?? "GREEN";
      if (phase !== lastPhaseRef.current) {
        if (phase === "RED") phaseFlashRef.current = 1;
        lastPhaseRef.current = phase;
      }
    };
    syncSelf();
    room.onStateChange(syncSelf);
  }, [room]);

  useEffect(() => {
    const push = () => {
      const now = Date.now();
      const rs = room.state as unknown as ServerState;
      if (!rs.players?.forEach) return;
      const next: PosBuf = new Map();
      rs.players.forEach((p, sid) => {
        const curr = { t: now, x: p.x, y: p.y };
        const existing = playerBufRef.current.get(sid);
        next.set(sid, { prev: existing?.curr ?? curr, curr });
      });
      playerBufRef.current = next;
    };
    push();
    room.onStateChange(push);
  }, [room]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.toLowerCase();
      if (k === "w" || k === "arrowup") keysRef.current.w = down;
      if (k === " ") {
        keysRef.current.space = down;
        if (down) e.preventDefault();
      }
      if (k === "a" || k === "arrowleft") keysRef.current.a = down;
      if (k === "d" || k === "arrowright") keysRef.current.d = down;
    };
    window.addEventListener("keydown", (e) => onKey(e, true));
    window.addEventListener("keyup", (e) => onKey(e, false));
    return () => {
      window.removeEventListener("keydown", (e) => onKey(e, true));
      window.removeEventListener("keyup", (e) => onKey(e, false));
    };
  }, []);

  useEffect(() => startRedLightInputLoop(room, inputRef, 1000 / 60), [room]);

  useEffect(() => {
    const tick = () => {
      const k = keysRef.current;
      const forward = holdRef.current || k.w || k.space;
      inputRef.current = {
        moveX: (k.d ? 1 : 0) - (k.a ? 1 : 0),
        moveY: forward ? -1 : 0,
        forward,
      };
    };
    const id = window.setInterval(tick, 1000 / 60);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      const rs = room.state as unknown as ServerState;
      const me = getPlayer(rs, room.sessionId);
      const startY = rs.startLineY ?? RLGL_START_Y;
      const finishY = rs.finishLineY ?? RLGL_FINISH_Y;
      const trackLen = rs.trackLength ?? RLGL_TRACK_LENGTH;
      const halfW = (rs.trackWidth ?? RLGL_TRACK_WIDTH) / 2;
      const phase = rs.lightPhase ?? "GREEN";
      const round = rs.roundNumber ?? 1;
      const now = Date.now();

      const mePos = interpPos(playerBufRef.current.get(room.sessionId)) ?? {
        x: me?.x ?? 0,
        y: me?.y ?? startY,
      };

      const progress = Math.max(0, Math.min(1, (startY - mePos.y) / (startY - finishY)));
      const lookAhead = lerp(520, 720, progress);
      const targetCamY = mePos.y - lookAhead;
      const targetCamX = mePos.x * 0.55;

      if (!camRef.current.init) {
        camRef.current.x = targetCamX;
        camRef.current.y = targetCamY;
        camRef.current.init = true;
      } else {
        camRef.current.x = lerp(camRef.current.x, targetCamX, 0.08);
        camRef.current.y = lerp(camRef.current.y, targetCamY, 0.065);
      }

      ctx.fillStyle = "#1a1020";
      ctx.fillRect(0, 0, w, h);

      const scale = Math.min(w / VIEW_W, h / VIEW_H) * 0.92;
      ctx.save();
      ctx.translate(w / 2, h * 0.7);
      ctx.scale(scale, scale * PERSPECTIVE_Y);
      ctx.translate(-camRef.current.x, -camRef.current.y);

      drawSquidGameField(ctx, {
        halfW,
        trackLength: trackLen,
        startY,
        finishY,
        camY: camRef.current.y,
      });

      const timing = rlglRoundTiming(round);
      const turn01 = dollTurnProgress(phase, rs.phaseEndsAtMs ?? 0, now, timing.turningMs);
      drawYoungHeeDoll(ctx, 0, finishY - 70, 0.95, turn01, phase);

      for (let g = -4; g <= 4; g++) {
        drawPinkGuard(ctx, g * 62, startY + 52, 1.05);
      }

      forEachPlayer(rs, (p, sid) => {
        if (!p.alive && !p.placement) {
          if (p.deathAt && now - p.deathAt < 1200) {
            ctx.globalAlpha = 0.4;
          } else if (!p.placement) return;
        }

        const pos = interpPos(playerBufRef.current.get(sid)) ?? { x: p.x, y: p.y };
        const isMe = sid === room.sessionId;
        const legacy = migrateLegacyAccessories(parseSlimeAccessories(p.slimeAccessories));

        drawSlime(
          ctx,
          pos.x,
          pos.y,
          PLAYER_R * (isMe ? 1.08 : 1),
          parseSlimeColor(p.slimeColor || DEFAULT_SLIME_COLOR),
          parseSlimeFace(p.slimeFace),
          -Math.PI / 2,
          false,
          false,
          now,
          legacy.head,
          legacy.body
        );
        ctx.globalAlpha = 1;

        if (isMe || progress > 0.5) {
          ctx.fillStyle = parseNameColor(p.nameColor);
          ctx.font = `${isMe ? "bold" : "normal"} 10px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(p.displayName.slice(0, 10), pos.x, pos.y - PLAYER_R - 6);
        }

        if (isMe) {
          ctx.strokeStyle = phase === "GREEN" ? "#4ade80" : "#f87171";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, PLAYER_R + 5, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      ctx.restore();

      if (phase === "GREEN") {
        ctx.fillStyle = "rgba(34, 197, 94, 0.22)";
        ctx.fillRect(0, 0, w, h);
      } else if (phase === "RED") {
        const flash = phaseFlashRef.current;
        ctx.fillStyle = `rgba(239, 68, 68, ${0.28 + flash * 0.25})`;
        ctx.fillRect(0, 0, w, h);
        phaseFlashRef.current = Math.max(0, flash - 0.04);
      } else {
        ctx.fillStyle = "rgba(251, 191, 36, 0.18)";
        ctx.fillRect(0, 0, w, h);
      }

      const matchLeft = Math.max(0, Math.ceil(((rs.matchEndsAtMs ?? 0) - now) / 1000));
      const phaseLeft = Math.max(0, Math.ceil(((rs.phaseEndsAtMs ?? 0) - now) / 1000));

      ctx.fillStyle = "rgba(0,0,0,0.62)";
      ctx.fillRect(0, 0, w, 58);

      ctx.textAlign = "center";
      ctx.font = "bold 15px sans-serif";
      if (phase === "GREEN") {
        ctx.fillStyle = "#4ade80";
        ctx.fillText("GREEN LIGHT", w / 2, 22);
        ctx.font = "11px sans-serif";
        ctx.fillStyle = "#bbf7d0";
        ctx.fillText(`무궁화 꽃이 피었습니다 · ${phaseLeft}s`, w / 2, 42);
      } else if (phase === "TURNING") {
        ctx.fillStyle = "#fbbf24";
        ctx.fillText("THE DOLL IS TURNING…", w / 2, 26);
      } else {
        ctx.fillStyle = "#f87171";
        ctx.fillText("RED LIGHT — FREEZE!", w / 2, 22);
        ctx.font = "11px sans-serif";
        ctx.fillStyle = "#fecaca";
        ctx.fillText(`Round ${round} · hold still`, w / 2, 42);
      }

      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = "12px monospace";
      ctx.fillText(`${matchLeft}s`, w - 12, 24);
      ctx.fillText(`R${round}`, w - 12, 42);

      const barW = Math.min(280, w - 48);
      const barX = (w - barW) / 2;
      const barY = h - 28;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(barX - 4, barY - 4, barW + 8, 16);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(barX, barY, barW, 8);
      ctx.fillStyle = phase === "GREEN" ? "#22c55e" : "#ef4444";
      ctx.fillRect(barX, barY, barW * progress, 8);
      ctx.fillStyle = "#fff";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(progress * 100)}% to finish`, w / 2, barY - 6);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [room]);

  const me = getPlayer(room.state as unknown as ServerState, room.sessionId);
  const isSpectator = me && !me.alive && !(me.deathAt ?? 0);
  const phase = (room.state as unknown as ServerState).lightPhase ?? "GREEN";

  return (
    <div className="relative flex-1 min-h-0 flex flex-col bg-[#1a0a12]">
      <canvas ref={canvasRef} className="flex-1 w-full min-h-0 touch-none" />

      {!ended && !eliminated && !finished && !isSpectator && (
        <button
          type="button"
          className={`absolute bottom-14 left-1/2 -translate-x-1/2 w-[min(300px,78vw)] py-5 rounded-full text-white font-pixel text-[11px] tracking-widest select-none touch-none transition-all ${
            phase === "GREEN"
              ? "bg-green-600 active:bg-green-500 shadow-[0_0_36px_rgba(34,197,94,0.55)] scale-100"
              : "bg-neutral-700 opacity-60 scale-95 pointer-events-none"
          }`}
          onPointerDown={() => {
            if (phase === "GREEN") holdRef.current = true;
          }}
          onPointerUp={() => {
            holdRef.current = false;
          }}
          onPointerLeave={() => {
            holdRef.current = false;
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {phase === "GREEN" ? "HOLD TO RUN" : "FREEZE!"}
        </button>
      )}

      {(eliminated || finished || ended) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/75 p-6">
          <div className="max-w-sm w-full rounded-lg border border-pink-500/40 bg-[#2a1020] p-6 text-center space-y-3">
            {finished ? (
              <>
                <p className="font-pixel text-green-400 text-[10px] tracking-widest">YOU FINISHED</p>
                <p className="font-pixel text-3xl text-yellow-300">#{placement}</p>
                <p className="text-sm text-pink-200/70">{Math.round(progressPct * 100)}% of the field</p>
              </>
            ) : eliminated ? (
              <>
                <p className="font-pixel text-red-400 text-[10px] tracking-widest">ELIMINATED</p>
                <p className="font-pixel-body text-pink-100">The doll saw you move.</p>
                <p className="text-sm text-pink-200/60">{Math.round(progressPct * 100)}% reached</p>
              </>
            ) : (
              <p className="font-pixel text-pink-300 text-[10px] tracking-widest">MATCH OVER</p>
            )}
            <button
              type="button"
              onClick={onLeave}
              className="w-full border border-pink-500/50 py-3 text-[11px] uppercase tracking-widest text-pink-200 hover:bg-pink-950/50"
            >
              Back to lobby
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onLeave}
        className="absolute top-14 left-2 px-3 py-1.5 text-[10px] uppercase tracking-widest bg-black/50 text-pink-200 border border-pink-900/40"
      >
        Leave
      </button>
    </div>
  );
}
