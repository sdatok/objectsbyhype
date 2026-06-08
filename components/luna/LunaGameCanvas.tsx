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
import {
  DEFAULT_SLIME_COLOR,
  migrateLegacyAccessories,
  parseNameColor,
  parseSlimeAccessories,
  parseSlimeColor,
  parseSlimeFace,
} from "@/lib/survivor-slime";
import { drawLunaDog, drawLunaPuppy } from "@/components/luna/LunaDogSprite";
import {
  drawLunaObstacle,
  preloadLunaObstacleSprites,
} from "@/components/luna/lunaObstacleSprites";
import LunaMatchEndOverlay, {
  type LunaEndSnapshot,
} from "@/components/luna/LunaMatchEndOverlay";

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
  placement?: number;
  deathAt?: number;
}

interface LunaServerState {
  status?: string;
  prizeTitle?: string;
  startedAtMs?: number;
  endedAtMs?: number;
  countdownEndsAtMs?: number;
  matchEndsAtMs?: number;
  zoneShrink01?: number;
  zone?: { cx: number; cy: number; radius: number };
  dog?: {
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
  obstacles?: Array<{ kind: string; x: number; y: number; w: number; h: number }>;
  bullets?: Array<{ x: number; y: number; vx: number; vy: number }>;
  players?: {
    forEach?: (cb: (p: LunaPlayerSnap, id: string) => void) => void;
    get?: (id: string) => LunaPlayerSnap | undefined;
  };
}

type LunaPosSnap = { t: number; x: number; y: number; aim: number };
type LunaPlayerBuffer = Map<string, { prev: LunaPosSnap; curr: LunaPosSnap }>;

function readPuppyMode(p: { alive?: boolean; puppyMode?: unknown }): boolean {
  if (p.alive) return false;
  const v = p.puppyMode;
  return v === true || v === 1;
}

function forEachLunaPlayer(
  rs: LunaServerState,
  cb: (p: LunaPlayerSnap, sessionId: string) => void
): void {
  rs.players?.forEach?.(cb);
}

function lookupLunaPlayer(
  rs: LunaServerState,
  sessionId: string
): LunaPlayerSnap | null {
  const players = rs.players;
  if (!players) return null;
  if (typeof players.get === "function") {
    return players.get(sessionId) ?? null;
  }
  let found: LunaPlayerSnap | null = null;
  players.forEach?.((p, id) => {
    if (!found && id === sessionId) found = p;
  });
  return found;
}

function shortestAngleLerp(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return a + diff * t;
}

function interpLunaPlayer(
  pair: { prev: LunaPosSnap; curr: LunaPosSnap } | undefined
): { x: number; y: number; aim: number } | null {
  if (!pair) return null;
  const renderT = Date.now() - INTERP_DELAY_MS;
  const { prev, curr } = pair;
  if (curr.t <= prev.t) return { x: curr.x, y: curr.y, aim: curr.aim };
  const span = curr.t - prev.t;
  const t = (renderT - prev.t) / span;
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return {
    x: prev.x + (curr.x - prev.x) * clamped,
    y: prev.y + (curr.y - prev.y) * clamped,
    aim: shortestAngleLerp(prev.aim, curr.aim, clamped),
  };
}

function puppyScreenRadius(scale: number, mobileControls: boolean): number {
  const base = PUPPY_R * scale * 1.35;
  return Math.max(base, mobileControls ? 18 : 14);
}

function snapshotLunaStatus(room: Room): LunaEndSnapshot & { status: string } {
  const empty = {
    status: "WAITING",
    selfPlacement: 0,
    selfDisplayName: "",
    selfSlimeColor: DEFAULT_SLIME_COLOR,
    selfSlimeFace: 0,
    selfSlimeAccessories: 0,
    selfNameColor: "#ffffff",
    selfAlive: false,
    selfPuppyMode: false,
    prizeTitle: "",
    survivedSeconds: 0,
    playerCount: 0,
  };
  try {
    const rs = room.state as unknown as {
      status?: string;
      prizeTitle?: string;
      startedAtMs?: number;
      endedAtMs?: number;
      players?: {
        forEach: (
          cb: (p: LunaPlayerSnap, id: string) => void
        ) => void;
      };
    };
    if (!rs?.players?.forEach) return empty;

    let playerCount = 0;
    let me: LunaPlayerSnap | undefined;
    rs.players.forEach((p: LunaPlayerSnap, id: string) => {
      if (p.alive || readPuppyMode(p) || (p.placement ?? 0) > 0) playerCount++;
      if (id === room.sessionId) me = p;
    });

    const startedAtMs = Number(rs.startedAtMs ?? 0);
    const endedAtMs = Number(rs.endedAtMs ?? 0);
    let survivedSeconds = 0;
    if (startedAtMs > 0) {
      const endMs =
        me?.deathAt && me.deathAt > 0
          ? me.deathAt
          : endedAtMs > 0
            ? endedAtMs
            : Date.now();
      survivedSeconds = Math.max(0, Math.floor((endMs - startedAtMs) / 1000));
    }

    return {
      status: rs.status ?? "WAITING",
      selfPlacement: me?.placement ?? 0,
      selfDisplayName: me?.displayName ?? "",
      selfSlimeColor: parseSlimeColor(me?.slimeColor),
      selfSlimeFace: parseSlimeFace(me?.slimeFace),
      selfSlimeAccessories: parseSlimeAccessories(me?.slimeAccessories),
      selfNameColor: parseNameColor(me?.nameColor),
      selfAlive: me?.alive ?? false,
      selfPuppyMode: me ? readPuppyMode(me) : false,
      prizeTitle: rs.prizeTitle ?? "",
      survivedSeconds,
      playerCount,
    };
  } catch {
    return empty;
  }
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
  const roomRef = useRef(room);
  const playerBufRef = useRef<LunaPlayerBuffer>(new Map());
  const moveStickRef = useRef<VirtualStickState>(emptyStick());
  const aimStickRef = useRef<VirtualStickState>(emptyStick());
  const mobileControls = useMobileControls();
  const spectatorCamRef = useRef({ x: 0, y: 0, ready: false });
  const [endSnapshot, setEndSnapshot] = useState(() => snapshotLunaStatus(room));

  useEffect(() => {
    roomRef.current = room;
    sessionIdRef.current = room.sessionId;
  }, [room]);

  useEffect(() => {
    const sync = () => setEndSnapshot(snapshotLunaStatus(room));
    sync();
    room.onStateChange(sync);
  }, [room]);

  useEffect(() => {
    preloadLunaObstacleSprites();
  }, []);

  useEffect(() => {
    const push = () => {
      const now = Date.now();
      const rs = room.state as unknown as LunaServerState;
      if (!rs?.players?.forEach) return;
      const next: LunaPlayerBuffer = new Map();
      rs.players.forEach((p, sessionId) => {
        const curr: LunaPosSnap = {
          t: now,
          x: p.x ?? 0,
          y: p.y ?? 0,
          aim: p.aim ?? 0,
        };
        const existing = playerBufRef.current.get(sessionId);
        next.set(sessionId, {
          prev: existing?.curr ?? curr,
          curr,
        });
      });
      playerBufRef.current = next;
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

      const rs = roomRef.current?.state as unknown as LunaServerState | undefined;
      if (!rs?.players?.forEach) {
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

      const selfLive = lookupLunaPlayer(rs, sessionIdRef.current);
      const selfPos =
        interpLunaPlayer(playerBufRef.current.get(sessionIdRef.current)) ?? {
          x: selfLive?.x ?? 0,
          y: selfLive?.y ?? 0,
          aim: selfLive?.aim ?? 0,
        };
      const isRunner = !!selfLive?.alive;
      const isPuppy = !!selfLive && readPuppyMode(selfLive);
      const isSpectating = !!selfLive && !selfLive.alive && !readPuppyMode(selfLive);

      if (isSpectating) {
        inputRef.current.moveX = 0;
        inputRef.current.moveY = 0;
        if (!spectatorCamRef.current.ready) {
          spectatorCamRef.current = {
            x: rs.zone?.cx ?? 0,
            y: rs.zone?.cy ?? 0,
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

      const camX = isSpectating ? spectatorCamRef.current.x : selfPos.x;
      const camY = isSpectating ? spectatorCamRef.current.y : selfPos.y;
      const viewSpan = isSpectating ? SPECTATOR_VIEW : RUNNER_VIEW;
      const scale = Math.min(w, h) / viewSpan;
      const toScreen = (wx: number, wy: number) => ({
        x: w / 2 + (wx - camX) * scale,
        y: h / 2 + (wy - camY) * scale,
      });

      ctx.fillStyle = "#0a0a12";
      ctx.fillRect(0, 0, w, h);

      const zone = rs.zone ?? { cx: 0, cy: 0, radius: WORLD_HALF * 0.68 };
      const zc = toScreen(zone.cx, zone.cy);
      ctx.fillStyle = "#1c1410";
      ctx.beginPath();
      ctx.arc(zc.x, zc.y, zone.radius * scale, 0, Math.PI * 2);
      ctx.fill();

      const obstacles = rs.obstacles ?? [];
      for (const o of obstacles) {
        drawLunaObstacle(ctx, toScreen, o, scale);
      }

      ctx.strokeStyle = "rgba(255,200,80,0.35)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(zc.x, zc.y, zone.radius * scale, 0, Math.PI * 2);
      ctx.stroke();

      const bullets = rs.bullets ?? [];
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
      forEachLunaPlayer(rs, (p) => {
        if (p.alive) survivorCount++;
        else if (readPuppyMode(p)) puppyCount++;
      });

      forEachLunaPlayer(rs, (p, id) => {
        const pos =
          interpLunaPlayer(playerBufRef.current.get(id)) ?? {
            x: p.x ?? 0,
            y: p.y ?? 0,
            aim: p.aim ?? 0,
          };
        const sp = toScreen(pos.x, pos.y);
        if (p.alive) {
          const legacy = migrateLegacyAccessories(
            parseSlimeAccessories(p.slimeAccessories)
          );
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
            legacy.head,
            legacy.body
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
        } else if (readPuppyMode(p)) {
          const aim = pos.aim;
          drawLunaPuppy(
            ctx,
            sp.x,
            sp.y,
            puppyScreenRadius(scale, mobileControls),
            Math.cos(aim) * 80,
            Math.sin(aim) * 80,
            Date.now(),
            id === sessionIdRef.current ? "YOU" : p.displayName
          );
        }
      });

      const dog = rs.dog;
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
          `Zone ${Math.round((Number(rs.zoneShrink01) || 0) * 100)}% · speed ${speedPct}% · ${puppyCount} infected`,
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
      {endSnapshot.status === "ENDED" && (
        <LunaMatchEndOverlay snapshot={endSnapshot} onLeave={onLeave} />
      )}
    </div>
  );
}
