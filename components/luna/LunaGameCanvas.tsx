"use client";

import { useEffect, useRef, useState } from "react";
import type { Room } from "colyseus.js";
import { startLunaInputLoop, type LunaInput } from "@/lib/luna-client";
import MobileControls, {
  emptyStick,
  useMobileControls,
  type VirtualStickState,
} from "@/components/survivor/MobileControls";
import RetroOverlay from "@/components/survivor/RetroOverlay";
import { drawSlime } from "@/components/survivor/SlimeAvatar";
import { drawLunaDog } from "@/components/luna/LunaDogSprite";
import { parseNameColor } from "@/lib/survivor-slime";

const WORLD = 2800;
const PLAYER_R = 18;
const LUNA_R = 26;
const INTERP_DELAY_MS = 130;

interface LunaGameCanvasProps {
  room: Room;
  onLeave: () => void;
}

export default function LunaGameCanvas({ room, onLeave }: LunaGameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<LunaInput>({
    moveX: 0,
    moveY: 0,
    aim: 0,
    shooting: false,
  });
  const keysRef = useRef(new Set<string>());
  const sessionIdRef = useRef(room.sessionId);
  const snapshotsRef = useRef<Array<{ t: number; state: unknown }>>([]);
  const moveStickRef = useRef<VirtualStickState>(emptyStick());
  const aimStickRef = useRef<VirtualStickState>(emptyStick());
  const mobileControls = useMobileControls();
  const [selfAlive, setSelfAlive] = useState(true);

  useEffect(() => {
    const push = () => {
      snapshotsRef.current.push({ t: Date.now(), state: room.state.toJSON() });
      if (snapshotsRef.current.length > 8) snapshotsRef.current.shift();
    };
    push();
    room.onStateChange(push);
    return () => {
      const registry = room.onStateChange as unknown as {
        remove?: (fn: typeof push) => void;
      };
      registry.remove?.(push);
    };
  }, [room]);

  useEffect(() => startLunaInputLoop(room, inputRef, 1000 / 30), [room]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => keysRef.current.add(e.key.toLowerCase());
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      const snaps = snapshotsRef.current;
      const renderAt = Date.now() - INTERP_DELAY_MS;
      let cur = snaps[snaps.length - 1]?.state as Record<string, unknown> | undefined;
      for (let i = snaps.length - 1; i >= 0; i--) {
        if (snaps[i]!.t <= renderAt) {
          cur = snaps[i]!.state as Record<string, unknown>;
          break;
        }
      }
      if (!cur) {
        raf = requestAnimationFrame(draw);
        return;
      }

      const stick = moveStickRef.current;
      let moveX = 0;
      let moveY = 0;
      if (stick.active) {
        moveX = stick.moveX;
        moveY = stick.moveY;
      } else {
        const k = keysRef.current;
        moveX =
          (k.has("d") || k.has("arrowright") ? 1 : 0) +
          (k.has("a") || k.has("arrowleft") ? -1 : 0);
        moveY =
          (k.has("s") || k.has("arrowdown") ? 1 : 0) +
          (k.has("w") || k.has("arrowup") ? -1 : 0);
        const len = Math.hypot(moveX, moveY) || 1;
        moveX /= len;
        moveY /= len;
      }
      inputRef.current.moveX = moveX;
      inputRef.current.moveY = moveY;
      inputRef.current.aim = Math.atan2(moveY, moveX);
      inputRef.current.shooting = false;

      const players = (cur.players ?? {}) as Record<
        string,
        {
          x: number;
          y: number;
          displayName: string;
          alive: boolean;
          slimeColor: string;
          slimeFace: number;
          slimeAccessories: number;
          nameColor: string;
          hp: number;
          maxHp: number;
        }
      >;
      const self = players[sessionIdRef.current];
      if (self && self.alive !== selfAlive) setSelfAlive(self.alive);
      const camX = self?.x ?? 0;
      const camY = self?.y ?? 0;
      const scale = Math.min(w, h) / (WORLD * 0.55);
      const toScreen = (wx: number, wy: number) => ({
        x: w / 2 + (wx - camX) * scale,
        y: h / 2 + (wy - camY) * scale,
      });

      ctx.fillStyle = "#0a0a12";
      ctx.fillRect(0, 0, w, h);

      const zone = cur.zone as { cx: number; cy: number; radius: number };
      const zc = toScreen(zone.cx, zone.cy);
      ctx.fillStyle = "#1c1410";
      ctx.beginPath();
      ctx.arc(zc.x, zc.y, zone.radius * scale, 0, Math.PI * 2);
      ctx.fill();

      const obstacles = (cur.obstacles ?? []) as Array<{
        kind: string;
        x: number;
        y: number;
        w: number;
        h: number;
      }>;
      for (const o of obstacles) {
        const p = toScreen(o.x, o.y);
        ctx.fillStyle = o.kind === "rock" ? "#4a4a52" : "#2d241c";
        ctx.strokeStyle = "#1a1510";
        ctx.lineWidth = 2;
        ctx.fillRect(
          p.x - (o.w * scale) / 2,
          p.y - (o.h * scale) / 2,
          o.w * scale,
          o.h * scale
        );
        ctx.strokeRect(
          p.x - (o.w * scale) / 2,
          p.y - (o.h * scale) / 2,
          o.w * scale,
          o.h * scale
        );
      }

      ctx.strokeStyle = "rgba(255,200,80,0.35)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(zc.x, zc.y, zone.radius * scale, 0, Math.PI * 2);
      ctx.stroke();

      for (const [id, p] of Object.entries(players)) {
        if (!p.alive) continue;
        const sp = toScreen(p.x, p.y);
        drawSlime(
          ctx,
          sp.x,
          sp.y,
          PLAYER_R * scale * 1.1,
          p.slimeColor,
          p.slimeFace,
          0,
          false,
          false,
          Date.now(),
          p.slimeAccessories
        );
        if (id === sessionIdRef.current) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, PLAYER_R * scale * 1.35, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = parseNameColor(p.nameColor);
        ctx.font = "11px monospace";
        ctx.textAlign = "center";
        ctx.fillText(p.displayName, sp.x, sp.y - PLAYER_R * scale * 2);
      }

      const dog = cur.dog as { x: number; y: number; vx?: number; vy?: number; speed: number };
      if (dog) {
        const dp = toScreen(dog.x, dog.y);
        drawLunaDog(
          ctx,
          dp.x,
          dp.y,
          LUNA_R * scale * 1.2,
          dog.vx ?? 0,
          dog.vy ?? 0,
          dog.speed ?? 0,
          Date.now()
        );
      }

      const hudPadTop = mobileControls ? 52 : 24;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = `${Math.max(11, Math.round(w * 0.028))}px monospace`;
      ctx.textAlign = "left";
      ctx.fillText("RUN FROM LUNA", 16, hudPadTop);
      ctx.fillText(
        `Zone ${Math.round((Number(cur.zoneShrink01) || 0) * 100)}%`,
        16,
        hudPadTop + 18
      );
      if (self && !self.alive) {
        ctx.fillStyle = "rgba(240,80,80,0.9)";
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "center";
        ctx.fillText("CAUGHT BY LUNA", w / 2, h / 2);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [moveStickRef, mobileControls]);

  return (
    <div
      ref={containerRef}
      className="flex-1 relative w-full min-h-0 overflow-hidden select-none touch-none overscroll-none bg-black"
    >
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      <MobileControls
        moveStickRef={moveStickRef}
        aimStickRef={aimStickRef}
        enabled={mobileControls && selfAlive}
        aimEnabled={false}
      />
      <button
        type="button"
        onClick={onLeave}
        className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] z-20 min-h-[44px] px-3 py-2 text-[10px] uppercase tracking-widest border border-white/30 text-white/80 hover:bg-white/10 active:bg-white/20"
      >
        Leave
      </button>
      <RetroOverlay />
    </div>
  );
}
