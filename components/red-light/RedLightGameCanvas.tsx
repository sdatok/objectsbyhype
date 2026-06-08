"use client";

import { useEffect, useRef, useState } from "react";
import type { Room } from "colyseus.js";
import { startRedLightInputLoop, type RedLightInput } from "@/lib/red-light-client";
import { drawSlime } from "@/components/survivor/SlimeAvatar";
import {
  DEFAULT_SLIME_COLOR,
  migrateLegacyAccessories,
  parseNameColor,
  parseSlimeAccessories,
  parseSlimeColor,
  parseSlimeFace,
} from "@/lib/survivor-slime";

const TRACK_W = 720;
const TRACK_L = 1500;
const PLAYER_R = 16;
const VIEW_H = 520;

const COLORS = {
  skyTop: "#E8998D",
  skyBot: "#F5C4B8",
  sand: "#E8C99B",
  sandDark: "#C9A66B",
  wallPink: "#D4737A",
  tree: "#1B4332",
  treeLight: "#2D6A6A",
  finish: "#F4D03F",
  greenGlow: "rgba(34, 197, 94, 0.35)",
  redGlow: "rgba(239, 68, 68, 0.45)",
};

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
  prizeTitle?: string;
  matchEndsAtMs?: number;
  lightPhase?: string;
  roundNumber?: number;
  phaseEndsAtMs?: number;
  startLineY?: number;
  finishLineY?: number;
  trackWidth?: number;
  players?: {
    forEach?: (cb: (p: PlayerSnap, id: string) => void) => void;
    get?: (id: string) => PlayerSnap | undefined;
  };
}

function forEachPlayer(
  rs: ServerState,
  cb: (p: PlayerSnap, id: string) => void
): void {
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

function drawTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number
) {
  const s = scale;
  ctx.fillStyle = COLORS.tree;
  ctx.beginPath();
  ctx.moveTo(x, y - 80 * s);
  ctx.lineTo(x - 28 * s, y + 10 * s);
  ctx.lineTo(x + 28 * s, y + 10 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.treeLight;
  ctx.beginPath();
  ctx.moveTo(x, y - 55 * s);
  ctx.lineTo(x - 18 * s, y - 5 * s);
  ctx.lineTo(x + 18 * s, y - 5 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#5D4037";
  ctx.fillRect(x - 6 * s, y + 8 * s, 12 * s, 22 * s);
}

function drawDoll(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facingPlayers: boolean,
  turning: boolean
) {
  const rot = turning ? Math.sin(Date.now() / 120) * 0.4 : facingPlayers ? Math.PI : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);

  ctx.fillStyle = "#F4D03F";
  ctx.fillRect(-35, -20, 70, 90);
  ctx.fillStyle = "#FFE082";
  ctx.fillRect(-30, 10, 60, 55);

  ctx.fillStyle = "#FFDBAC";
  ctx.beginPath();
  ctx.arc(0, -45, 32, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(0, -52, 34, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-34, -58, 68, 12);

  if (facingPlayers || turning) {
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(-12, -48, 4, 0, Math.PI * 2);
    ctx.arc(12, -48, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -38);
    ctx.lineTo(8, -38);
    ctx.stroke();
  }

  ctx.fillStyle = "#E91E8C";
  ctx.fillRect(-8, 65, 16, 25);
  ctx.restore();
}

function drawGuard(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#E91E8C";
  ctx.fillRect(x - 8, y - 28, 16, 32);
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(x, y - 34, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillRect(x - 12, y - 18, 24, 3);
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
  const [eliminated, setEliminated] = useState(false);
  const [finished, setFinished] = useState(false);
  const [placement, setPlacement] = useState(0);
  const [ended, setEnded] = useState(false);

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
    };
    syncSelf();
    room.onStateChange(syncSelf);
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
    const down = (e: KeyboardEvent) => onKey(e, true);
    const up = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const stopInput = startRedLightInputLoop(room, inputRef);
    return stopInput;
  }, [room]);

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
    const id = window.setInterval(tick, 1000 / 30);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      const rs = room.state as unknown as ServerState;
      const me = getPlayer(rs, room.sessionId);
      const camY = me?.y ?? TRACK_L / 2 - 80;
      const camX = me?.x ?? 0;

      const phase = rs.lightPhase ?? "GREEN";
      const facing = phase === "RED" || phase === "TURNING";

      ctx.fillStyle = COLORS.skyTop;
      ctx.fillRect(0, 0, w, h);

      const scale = h / VIEW_H;
      ctx.save();
      ctx.translate(w / 2, h * 0.55);
      ctx.scale(scale, scale);
      ctx.translate(-camX, -camY);

      const halfW = (rs.trackWidth ?? TRACK_W) / 2;

      ctx.fillStyle = COLORS.sand;
      ctx.fillRect(-halfW - 40, -TRACK_L / 2, TRACK_W + 80, TRACK_L);

      for (let i = 0; i < 8; i++) {
        const ty = -TRACK_L / 2 + i * 200 + 80;
        drawTree(ctx, -halfW - 55, ty, 0.9);
        drawTree(ctx, halfW + 55, ty + 60, 0.85);
      }

      ctx.fillStyle = COLORS.wallPink;
      ctx.fillRect(-halfW - 60, -TRACK_L / 2 - 120, TRACK_W + 120, 100);

      const finishY = rs.finishLineY ?? -TRACK_L / 2 + 60;
      ctx.strokeStyle = COLORS.finish;
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.moveTo(-halfW, finishY);
      ctx.lineTo(halfW, finishY);
      ctx.stroke();
      ctx.setLineDash([]);

      drawDoll(ctx, 0, finishY - 90, facing, phase === "TURNING");

      const startY = rs.startLineY ?? TRACK_L / 2 - 80;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-halfW, startY);
      ctx.lineTo(halfW, startY);
      ctx.stroke();

      for (let g = -3; g <= 3; g++) {
        drawGuard(ctx, g * 55, startY + 45);
      }

      forEachPlayer(rs, (p, sid) => {
        if (!p.alive && !p.placement) {
          if (p.deathAt && Date.now() - p.deathAt < 800) {
            ctx.globalAlpha = 0.35;
          } else if (!p.placement) return;
        }
        const isMe = sid === room.sessionId;
        const legacy = migrateLegacyAccessories(
          parseSlimeAccessories(p.slimeAccessories)
        );
        drawSlime(
          ctx,
          p.x,
          p.y,
          PLAYER_R,
          parseSlimeColor(p.slimeColor || DEFAULT_SLIME_COLOR),
          parseSlimeFace(p.slimeFace),
          -Math.PI / 2,
          false,
          false,
          Date.now(),
          legacy.head,
          legacy.body
        );
        ctx.globalAlpha = 1;
        ctx.fillStyle = parseNameColor(p.nameColor);
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(p.displayName.slice(0, 12), p.x, p.y - PLAYER_R - 8);
        if (isMe) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, PLAYER_R + 4, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      ctx.restore();

      if (phase === "GREEN") {
        ctx.fillStyle = COLORS.greenGlow;
        ctx.fillRect(0, 0, w, h);
      } else if (phase === "RED") {
        ctx.fillStyle = COLORS.redGlow;
        ctx.fillRect(0, 0, w, h);
      }

      const matchLeft = Math.max(
        0,
        Math.ceil(((rs.matchEndsAtMs ?? 0) - Date.now()) / 1000)
      );
      const phaseLeft = Math.max(
        0,
        Math.ceil(((rs.phaseEndsAtMs ?? 0) - Date.now()) / 1000)
      );

      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, w, 56);
      ctx.textAlign = "center";
      ctx.font = "bold 14px sans-serif";
      if (phase === "GREEN") {
        ctx.fillStyle = "#4ade80";
        ctx.fillText("GREEN LIGHT — GO!", w / 2, 22);
        ctx.font = "11px sans-serif";
        ctx.fillStyle = "#bbf7d0";
        ctx.fillText(`무궁화 꽃이 피었습니다 · ${phaseLeft}s`, w / 2, 40);
      } else if (phase === "TURNING") {
        ctx.fillStyle = "#fbbf24";
        ctx.fillText("TURNING…", w / 2, 28);
      } else {
        ctx.fillStyle = "#f87171";
        ctx.fillText("RED LIGHT — FREEZE!", w / 2, 22);
        ctx.font = "11px sans-serif";
        ctx.fillStyle = "#fecaca";
        ctx.fillText(`현재 등판 · Round ${rs.roundNumber ?? 1}`, w / 2, 40);
      }

      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = "12px monospace";
      ctx.fillText(`${matchLeft}s left`, w - 12, 28);
      ctx.fillText(`Round ${rs.roundNumber ?? 1}`, w - 12, 44);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [room]);

  const me = getPlayer(room.state as unknown as ServerState, room.sessionId);
  const isSpectator = me && !me.alive && !(me.deathAt ?? 0);

  return (
    <div className="relative flex-1 min-h-0 flex flex-col bg-[#1a0a12]">
      <canvas ref={canvasRef} className="flex-1 w-full min-h-0 touch-none" />

      {!ended && !eliminated && !finished && !isSpectator && (
        <button
          type="button"
          className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[min(280px,70vw)] py-5 rounded-full bg-green-600 active:bg-green-500 text-white font-pixel text-[11px] tracking-widest shadow-[0_0_32px_rgba(34,197,94,0.5)] select-none touch-none"
          onPointerDown={() => {
            holdRef.current = true;
          }}
          onPointerUp={() => {
            holdRef.current = false;
          }}
          onPointerLeave={() => {
            holdRef.current = false;
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          HOLD TO GO
        </button>
      )}

      {(eliminated || finished || ended) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6">
          <div className="max-w-sm w-full rounded-lg border border-pink-500/40 bg-[#2a1020] p-6 text-center space-y-3">
            {finished ? (
              <>
                <p className="font-pixel text-green-400 text-[10px] tracking-widest">
                  YOU FINISHED
                </p>
                <p className="font-pixel text-3xl text-yellow-300">#{placement}</p>
              </>
            ) : eliminated ? (
              <>
                <p className="font-pixel text-red-400 text-[10px] tracking-widest">
                  ELIMINATED
                </p>
                <p className="font-pixel-body text-pink-100">You moved on red light.</p>
              </>
            ) : (
              <p className="font-pixel text-pink-300 text-[10px] tracking-widest">
                MATCH OVER
              </p>
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
        className="absolute top-2 left-2 px-3 py-1.5 text-[10px] uppercase tracking-widest bg-black/50 text-pink-200 border border-pink-900/40"
      >
        Leave
      </button>
    </div>
  );
}
