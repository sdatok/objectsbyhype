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
import { drawLunaDog, drawLunaPuppy } from "@/components/luna/LunaDogSprite";
import {
  drawLunaObstacle,
  drawLunaPit,
  preloadLunaObstacleSprites,
} from "@/components/luna/lunaObstacleSprites";
import { parseNameColor } from "@/lib/survivor-slime";

const WORLD = 2800;
const WORLD_HALF = WORLD / 2;
const PLAYER_R = 18;
const LUNA_R = 18;
const PUPPY_R = 11;
const RUNNER_VIEW = WORLD * 0.55;
const SPECTATOR_VIEW = WORLD * 0.78;
const INTERP_DELAY_MS = 130;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

interface LunaPlayerSnap {
  x: number;
  y: number;
  displayName: string;
  alive: boolean;
  puppyMode?: boolean;
  slimeColor: string;
  slimeFace: number;
  slimeAccessories: number;
  nameColor: string;
  hp: number;
  maxHp: number;
  aim?: number;
}

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
  const spectatorCamRef = useRef({ x: 0, y: 0, ready: false });
  const [selfMode, setSelfMode] = useState<"runner" | "puppy" | "spectator">("runner");

  useEffect(() => {
    preloadLunaObstacleSprites();
  }, []);

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
    let lastFrame = performance.now();
    const draw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const nowPerf = performance.now();
      const dt = Math.min(0.05, (nowPerf - lastFrame) / 1000);
      lastFrame = nowPerf;

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

      const players = (cur.players ?? {}) as Record<string, LunaPlayerSnap>;
      const self = players[sessionIdRef.current];
      const isRunner = !!self?.alive;
      const isPuppy = !!self && !self.alive && !!self.puppyMode;
      const isSpectating = !!self && !self.alive && !self.puppyMode;
      const nextMode = isRunner ? "runner" : isPuppy ? "puppy" : "spectator";
      if (nextMode !== selfMode) setSelfMode(nextMode);

      if (isSpectating) {
        inputRef.current.moveX = 0;
        inputRef.current.moveY = 0;
        if (!spectatorCamRef.current.ready) {
          const zone = cur.zone as { cx: number; cy: number };
          spectatorCamRef.current = {
            x: zone?.cx ?? 0,
            y: zone?.cy ?? 0,
            ready: true,
          };
        }
        const roamSpeed = 360;
        spectatorCamRef.current.x = clamp(
          spectatorCamRef.current.x + moveX * roamSpeed * dt,
          -WORLD_HALF,
          WORLD_HALF
        );
        spectatorCamRef.current.y = clamp(
          spectatorCamRef.current.y + moveY * roamSpeed * dt,
          -WORLD_HALF,
          WORLD_HALF
        );
      } else {
        spectatorCamRef.current.ready = false;
        inputRef.current.moveX = moveX;
        inputRef.current.moveY = moveY;
        inputRef.current.aim = Math.atan2(moveY, moveX);
      }
      inputRef.current.shooting = false;

      const camX = isSpectating ? spectatorCamRef.current.x : (self?.x ?? 0);
      const camY = isSpectating ? spectatorCamRef.current.y : (self?.y ?? 0);
      const viewSpan = isSpectating ? SPECTATOR_VIEW : RUNNER_VIEW;
      const scale = Math.min(w, h) / viewSpan;
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

      const pits = (cur.pits ?? []) as Array<{
        x: number;
        y: number;
        radius: number;
      }>;
      for (const pit of pits) {
        drawLunaPit(ctx, toScreen, pit, scale);
      }

      const obstacles = (cur.obstacles ?? []) as Array<{
        kind: string;
        x: number;
        y: number;
        w: number;
        h: number;
      }>;
      for (const o of obstacles) {
        drawLunaObstacle(ctx, toScreen, o, scale);
      }

      ctx.strokeStyle = "rgba(255,200,80,0.35)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(zc.x, zc.y, zone.radius * scale, 0, Math.PI * 2);
      ctx.stroke();

      const bullets = (cur.bullets ?? []) as Array<{
        x: number;
        y: number;
        vx: number;
        vy: number;
      }>;
      for (const b of bullets) {
        const bp = toScreen(b.x, b.y);
        const br = Math.max(3, 5 * scale);
        const glow = ctx.createRadialGradient(bp.x, bp.y, 0, bp.x, bp.y, br * 2.2);
        glow.addColorStop(0, "rgba(255,120,60,0.95)");
        glow.addColorStop(0.5, "rgba(255,40,30,0.55)");
        glow.addColorStop(1, "rgba(255,0,0,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, br * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff5533";
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, br, 0, Math.PI * 2);
        ctx.fill();
        const tailLen = Math.min(28, Math.hypot(b.vx, b.vy) * 0.04) * scale;
        if (tailLen > 2) {
          const tailAngle = Math.atan2(b.vy, b.vx);
          ctx.strokeStyle = "rgba(255,80,40,0.65)";
          ctx.lineWidth = Math.max(2, br * 0.7);
          ctx.beginPath();
          ctx.moveTo(bp.x, bp.y);
          ctx.lineTo(
            bp.x - Math.cos(tailAngle) * tailLen,
            bp.y - Math.sin(tailAngle) * tailLen
          );
          ctx.stroke();
        }
      }

      let puppyCount = 0;
      let survivorCount = 0;
      for (const p of Object.values(players)) {
        if (p.alive) survivorCount++;
        else if (p.puppyMode) puppyCount++;
      }

      for (const [id, p] of Object.entries(players)) {
        const sp = toScreen(p.x, p.y);
        if (p.alive) {
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
        } else if (p.puppyMode) {
          const aim = p.aim ?? 0;
          drawLunaPuppy(
            ctx,
            sp.x,
            sp.y,
            PUPPY_R * scale * 1.15,
            Math.cos(aim) * 80,
            Math.sin(aim) * 80,
            Date.now(),
            id === sessionIdRef.current ? "YOU" : p.displayName
          );
        }
      }

      const dog = cur.dog as {
        x: number;
        y: number;
        vx?: number;
        vy?: number;
        speed: number;
        jumpAtMs?: number;
        shootUntilMs?: number;
        aimAngle?: number;
        nextBarrageAtMs?: number;
      };
      const nowMs = Date.now();
      const lunaShooting = (dog?.shootUntilMs ?? 0) > nowMs;
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
          nowMs,
          dog.jumpAtMs ?? 0,
          lunaShooting,
          dog.aimAngle ?? 0
        );
      }

      const hudPadTop = mobileControls ? 52 : 24;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = `${Math.max(11, Math.round(w * 0.028))}px monospace`;
      ctx.textAlign = "left";
      if (isSpectating) {
        ctx.fillText("SPECTATING", 16, hudPadTop);
        ctx.fillText("WASD / stick to roam the map", 16, hudPadTop + 18);
      } else if (isPuppy) {
        ctx.fillText("PUPPY MODE", 16, hudPadTop);
        ctx.fillText(`Swarm ${puppyCount} · hunt ${survivorCount} left`, 16, hudPadTop + 18);
      } else {
        ctx.fillText("RUN FROM LUNA", 16, hudPadTop);
        let infection01 = 0;
        if (puppyCount > 0 && survivorCount > 0) {
          infection01 = puppyCount / (puppyCount + survivorCount);
        }
        let speedPct = 100;
        if (puppyCount > 0) {
          let mult = 1 + infection01 * 0.72;
          if (survivorCount === 1) mult += 0.48;
          speedPct = Math.round(Math.min(208, mult * 100));
        }
        ctx.fillText(
          `Zone ${Math.round((Number(cur.zoneShrink01) || 0) * 100)}% · speed ${speedPct}% · ${puppyCount} infected`,
          16,
          hudPadTop + 18
        );
        if (lunaShooting) {
          ctx.fillStyle = "rgba(255,80,60,0.95)";
          ctx.fillText("LUNA FIRING — dodge!", 16, hudPadTop + 36);
        } else if ((dog?.nextBarrageAtMs ?? 0) > nowMs) {
          const sec = Math.ceil((dog!.nextBarrageAtMs! - nowMs) / 1000);
          if (sec <= 5) {
            ctx.fillStyle = "rgba(255,180,80,0.9)";
            ctx.fillText(`Luna aims in ${sec}s`, 16, hudPadTop + 36);
          }
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [moveStickRef, mobileControls, selfMode]);

  return (
    <div
      ref={containerRef}
      className="flex-1 relative w-full min-h-0 overflow-hidden select-none touch-none overscroll-none bg-black"
    >
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      <MobileControls
        moveStickRef={moveStickRef}
        aimStickRef={aimStickRef}
        enabled={mobileControls}
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
