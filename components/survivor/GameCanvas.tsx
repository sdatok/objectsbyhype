"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "colyseus.js";
import { startInputLoop, type MutableInput } from "@/lib/survivor-client";
import MobileControls, {
  aimStickFiring,
  emptyStick,
  useMobileControls,
  type VirtualStickState,
} from "./MobileControls";
import RetroOverlay from "./RetroOverlay";

/**
 * Top-down 2D Survivor game. The server simulates at 30Hz; this client
 * interpolates between the last two server snapshots with a small delay so
 * everyone's motion looks smooth even at the slow tick rate.
 *
 * Render layers (bottom -> top):
 *   1. background fill + dual grid floor
 *   2. world boundary glow + danger-wash outside the safe zone
 *   3. safe-zone dashed rings
 *   4. pickups (rotating boxes)
 *   5. bullets (additive glow trails)
 *   6. players (squircles + barrels + name + hp bar + weapon timer arc)
 *   7. HUD (DOM, on top of canvas)
 *   8. RetroOverlay (CSS scanlines + vignette)
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
  weapon: string;
  weaponExpiresAtMs: number;
}

interface ServerBullet {
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spawnedAt: number;
  ttlMs: number;
  kind: string;
}

interface ServerPickup {
  kind: string;
  x: number;
  y: number;
  spawnedAt: number;
}

interface ServerObstacle {
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
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
  /** 0..1 safe-zone shrink progress (synced each server tick). */
  zoneShrink01: number;
  players:
    | Map<string, ServerPlayer>
    | { forEach: (cb: (p: ServerPlayer, k: string) => void) => void; size: number };
  bullets: ServerBullet[] | { forEach: (cb: (b: ServerBullet, idx: number) => void) => void; length: number };
  pickups: ServerPickup[] | { forEach: (cb: (p: ServerPickup) => void) => void; length: number };
  obstacles: ServerObstacle[] | { forEach: (cb: (o: ServerObstacle) => void) => void; length: number };
  zone: ServerZone;
}

// Must match game-server/src/constants.ts.
const WORLD = 2800;
const ZONE_START_RADIUS = 1900;
const ZONE_END_RADIUS = 320;
const PLAYER_R = 18;
const BULLET_R = 4;
const PICKUP_R = 14;

// Render one or two patches behind so we always have a "next" snapshot to
// lerp toward even under packet jitter. Server patches every ~33ms now, so
// 130ms is ~4 patches of buffer — plenty of headroom without feeling laggy.
const INTERP_DELAY_MS = 130;
const WEAPON_BUFF_MS = 20_000;

const OBSTACLE_SPRITE_URLS: Record<string, string> = {
  gorilla: "/survivor/obstacles/gorilla.png",
  flower: "/survivor/obstacles/flower.png",
};
const obstacleSpriteCache = new Map<string, HTMLImageElement>();

function preloadObstacleSprites(): void {
  for (const [kind, src] of Object.entries(OBSTACLE_SPRITE_URLS)) {
    if (obstacleSpriteCache.has(kind)) continue;
    const img = new Image();
    img.src = src;
    img.onload = () => {
      obstacleSpriteCache.set(kind, img);
    };
  }
}

const WEAPON_COLORS: Record<string, { core: string; glow: string; label: string }> = {
  pistol: { core: "#f5f5f5", glow: "rgba(245,245,245,0.55)", label: "PISTOL" },
  shotgun: { core: "#fbbf24", glow: "rgba(251,191,36,0.55)", label: "SHOTGUN" },
  rapid: { core: "#34d399", glow: "rgba(52,211,153,0.55)", label: "RAPID" },
  sniper: { core: "#f87171", glow: "rgba(248,113,113,0.55)", label: "SNIPER" },
  health: { core: "#4ade80", glow: "rgba(74,222,128,0.55)", label: "HEALTH" },
};

interface PlayerSnap {
  t: number;
  x: number;
  y: number;
  aim: number;
}
interface BulletSnap {
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: string;
}

type PlayerBuffer = Map<string, { prev: PlayerSnap; curr: PlayerSnap }>;
type BulletBuffer = Map<string, BulletSnap>;

export default function GameCanvas({ room, onLeave }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<MutableInput>({
    moveX: 0,
    moveY: 0,
    aim: 0,
    shooting: false,
  });

  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mouseShootingRef = useRef(false);
  const moveStickRef = useRef<VirtualStickState>(emptyStick());
  const aimStickRef = useRef<VirtualStickState>(emptyStick());
  const mobileControls = useMobileControls();
  const sessionIdRef = useRef<string>(room.sessionId);
  /** Match clock for zone shrink (updated every state patch). */
  const matchClockRef = useRef({
    startedAtMs: 0,
    matchEndsAtMs: 0,
    zoneShrink01: 0,
  });

  // Interpolation buffers. Each entry holds `prev` (older snapshot) and
  // `curr` (newer); we render at `now - INTERP_DELAY_MS` and lerp between
  // the bracketing pair.
  const playerBufRef = useRef<PlayerBuffer>(new Map());
  const bulletBufRef = useRef<BulletBuffer>(new Map());

  // Camera + screen-shake state, lerped in the render loop for smooth pan.
  const cameraRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const shakeRef = useRef<{ amount: number; until: number }>({
    amount: 0,
    until: 0,
  });

  // Used to detect HP drops between snapshots so we can fire shake/flash.
  const lastSelfHpRef = useRef<number>(100);

  // Transient UI events surfaced via room.send (kill feed + pickup toast).
  const [killFeed, setKillFeed] = useState<
    Array<{ id: number; killer: string; victim: string; expiresAt: number }>
  >([]);
  const [pickupToast, setPickupToast] = useState<{
    kind: string;
    expiresAt: number;
  } | null>(null);

  // HUD-relevant fields sampled from state at React rate.
  const [statusSnapshot, setStatusSnapshot] = useState<{
    status: ServerState["status"];
    aliveCount: number;
    selfAlive: boolean;
    selfHp: number;
    selfKills: number;
    selfPlacement: number;
    selfWeapon: string;
    selfWeaponExpiresAtMs: number;
    matchEndsAtMs: number;
    countdownEndsAtMs: number;
    startedAtMs: number;
    zoneShrink01: number;
  }>(() => snapshotStatus(room));

  useEffect(() => {
    sessionIdRef.current = room.sessionId;
    preloadObstacleSprites();
  }, [room]);

  // Push fresh snapshots into the interpolation buffer on each state patch.
  useEffect(() => {
    const cb = () => {
      const now = Date.now();
      try {
        const rs = room.state as unknown as ServerState | undefined;
        if (!rs) return;

        // Players: prev := old curr, curr := new.
        const next: PlayerBuffer = new Map();
        rs.players?.forEach?.((p: ServerPlayer, sessionId: string) => {
          const existing = playerBufRef.current.get(sessionId);
          const curr: PlayerSnap = {
            t: now,
            x: p.x ?? 0,
            y: p.y ?? 0,
            aim: p.aim ?? 0,
          };
          next.set(sessionId, {
            prev: existing?.curr ?? curr,
            curr,
          });
        });
        playerBufRef.current = next;

        // Bullets: re-snapshot fresh each tick. Render position is
        // extrapolated from (x, y) along (vx, vy) for smooth sub-tick motion.
        const nextBullets: BulletBuffer = new Map();
        rs.bullets?.forEach?.((b: ServerBullet, idx: number) => {
          const key = bulletKey(b, idx);
          nextBullets.set(key, {
            t: now,
            x: b.x ?? 0,
            y: b.y ?? 0,
            vx: b.vx ?? 0,
            vy: b.vy ?? 0,
            kind: b.kind || "pistol",
          });
        });
        bulletBufRef.current = nextBullets;

        // Damage detection on self -> kick screen shake.
        const self = lookupPlayer(rs, sessionIdRef.current);
        if (self) {
          const prevHp = lastSelfHpRef.current;
          if (self.hp < prevHp - 0.5) {
            const dmg = prevHp - self.hp;
            const intensity = Math.min(14, Math.max(3, dmg / 6));
            shakeRef.current = { amount: intensity, until: now + 220 };
          }
          lastSelfHpRef.current = self.hp;
        }

        matchClockRef.current = {
          startedAtMs: rs.startedAtMs ?? 0,
          matchEndsAtMs: rs.matchEndsAtMs ?? 0,
          zoneShrink01:
            typeof (rs as { zoneShrink01?: number }).zoneShrink01 === "number"
              ? (rs as { zoneShrink01: number }).zoneShrink01
              : 0,
        };
      } catch (e) {
        console.warn("[survivor] state patch snapshot failed", e);
      }
      setStatusSnapshot(snapshotStatus(room));
    };
    room.onStateChange(cb);
    return () => {
      room.onStateChange.remove(cb);
    };
  }, [room]);

  // Transient room messages: kills (broadcast) + pickup (targeted).
  useEffect(() => {
    const onKills = (
      payload: Array<{ killerName: string; victimName: string }>
    ) => {
      if (!Array.isArray(payload)) return;
      const now = Date.now();
      setKillFeed((prev) => {
        const next = [
          ...prev,
          ...payload.map((p, i) => ({
            id: now + i,
            killer: p.killerName,
            victim: p.victimName,
            expiresAt: now + 5000,
          })),
        ].slice(-4);
        return next;
      });
    };
    const onPickup = (payload: { kind: string }) => {
      if (!payload?.kind) return;
      setPickupToast({ kind: payload.kind, expiresAt: Date.now() + 1500 });
    };
    room.onMessage("event:kills", onKills);
    room.onMessage("event:pickup", onPickup);
    return () => {
      // colyseus.js cleans listeners on room.leave; nothing to undo here.
    };
  }, [room]);

  // GC kill-feed + pickup toast entries that have aged out.
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      setKillFeed((prev) => prev.filter((k) => k.expiresAt > now));
      setPickupToast((p) => (p && p.expiresAt > now ? p : null));
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  // 30Hz input loop.
  useEffect(() => {
    return startInputLoop(room, inputRef, 1000 / 30);
  }, [room]);

  // Canvas backing-store sizing.
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

  // Keyboard: WASD + arrows. Mouse button held anywhere on window.
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
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) mouseShootingRef.current = true;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) mouseShootingRef.current = false;
    };
    const onBlur = () => {
      keysRef.current.clear();
      mouseShootingRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // rAF render + input derivation.
  useEffect(() => {
    let raf = 0;
    let lastFrame = performance.now();
    const draw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) {
        raf = window.requestAnimationFrame(draw);
        return;
      }
      const nowPerf = performance.now();
      const dt = Math.min(0.05, (nowPerf - lastFrame) / 1000);
      lastFrame = nowPerf;

      const moveStick = moveStickRef.current;
      if (moveStick.active) {
        inputRef.current.moveX = moveStick.moveX;
        inputRef.current.moveY = moveStick.moveY;
      } else {
        const k = keysRef.current;
        const moveX =
          (k.has("d") || k.has("arrowright") ? 1 : 0) +
          (k.has("a") || k.has("arrowleft") ? -1 : 0);
        const moveY =
          (k.has("s") || k.has("arrowdown") ? 1 : 0) +
          (k.has("w") || k.has("arrowup") ? -1 : 0);
        const len = Math.hypot(moveX, moveY) || 1;
        inputRef.current.moveX = moveX / len;
        inputRef.current.moveY = moveY / len;
      }

      const rs = room.state as unknown as ServerState | undefined;
      if (!rs) {
        raf = window.requestAnimationFrame(draw);
        return;
      }

      // Lerp camera toward the (interpolated) self position.
      const selfInterp = interpPlayer(
        playerBufRef.current.get(sessionIdRef.current)
      );
      const targetX = selfInterp?.x ?? cameraRef.current.x;
      const targetY = selfInterp?.y ?? cameraRef.current.y;
      const cameraLerp = 1 - Math.exp(-dt * 8);
      cameraRef.current.x += (targetX - cameraRef.current.x) * cameraLerp;
      cameraRef.current.y += (targetY - cameraRef.current.y) * cameraLerp;

      // Aim: right stick on mobile, mouse on desktop.
      if (selfInterp) {
        const aimStick = aimStickRef.current;
        if (aimStick.active) {
          const ax = aimStick.moveX;
          const ay = aimStick.moveY;
          if (Math.hypot(ax, ay) > 0.05) {
            inputRef.current.aim = Math.atan2(ay, ax);
          }
          inputRef.current.shooting = aimStickFiring(aimStick);
        } else {
          const rect = canvas.getBoundingClientRect();
          const scale = computeWorldScale(rect.width, rect.height);
          const cx = rect.width / 2;
          const cy = rect.height / 2;
          const wx =
            (mouseRef.current.x - rect.left - cx) / scale + cameraRef.current.x;
          const wy =
            (mouseRef.current.y - rect.top - cy) / scale + cameraRef.current.y;
          inputRef.current.aim = Math.atan2(
            wy - selfInterp.y,
            wx - selfInterp.x
          );
          inputRef.current.shooting = mouseShootingRef.current;
        }
      }

      renderFrame(ctx, canvas, rs, sessionIdRef.current, cameraRef.current, {
        playerBuf: playerBufRef.current,
        bulletBuf: bulletBufRef.current,
        shake: shakeRef.current,
        now: Date.now(),
        matchClock: matchClockRef.current,
      });

      raf = window.requestAnimationFrame(draw);
    };
    raf = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(raf);
  }, [room]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    mouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) mouseShootingRef.current = true;
  }, []);
  const onMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) mouseShootingRef.current = false;
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
      className="flex-1 relative overflow-hidden select-none touch-none overscroll-none"
      style={{ minHeight: "60vh", background: "#061525" }}
    >
      <canvas
        ref={canvasRef}
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onContextMenu={onContextMenu}
        className={`block w-full h-full ${
          mobileControls ? "cursor-default" : "cursor-crosshair"
        }`}
      />
      <RetroOverlay />
      <MobileControls
        moveStickRef={moveStickRef}
        aimStickRef={aimStickRef}
        enabled={
          mobileControls &&
          statusSnapshot.status === "PLAYING" &&
          statusSnapshot.selfAlive
        }
      />
      <Hud
        snapshot={statusSnapshot}
        killFeed={killFeed}
        pickupToast={pickupToast}
        onLeave={onLeave}
        compact={mobileControls}
      />
    </div>
  );
}

// ============================================================
// HUD
// ============================================================

const MONO_FONT =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

function Hud(props: {
  snapshot: ReturnType<typeof snapshotStatus>;
  killFeed: Array<{ id: number; killer: string; victim: string; expiresAt: number }>;
  pickupToast: { kind: string; expiresAt: number } | null;
  onLeave: () => void;
  compact?: boolean;
}) {
  const { snapshot, killFeed, pickupToast, onLeave, compact } = props;
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => forceTick((t) => t + 1), 200);
    return () => window.clearInterval(id);
  }, []);

  let timerText = "";
  if (snapshot.status === "PLAYING" && snapshot.matchEndsAtMs) {
    const left = Math.max(0, snapshot.matchEndsAtMs - Date.now());
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    timerText = `${m}:${s.toString().padStart(2, "0")}`;
  }

  const weapon = (snapshot.selfWeapon || "pistol").toLowerCase();
  const weaponColor = WEAPON_COLORS[weapon] ?? WEAPON_COLORS.pistol;
  const weaponRemainingMs = Math.max(
    0,
    snapshot.selfWeaponExpiresAtMs - Date.now()
  );
  const weaponDrainPct =
    snapshot.selfWeaponExpiresAtMs > 0
      ? Math.max(0, Math.min(1, weaponRemainingMs / WEAPON_BUFF_MS))
      : 0;

  return (
    <>
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 pointer-events-none">
        <div
          className="border border-white/70 px-2 py-0.5 inline-flex items-center gap-1"
          style={{ fontFamily: MONO_FONT }}
        >
          <span className="text-[9px] uppercase tracking-[0.35em] text-white/90">
            OBJECTSBYHYPE
          </span>
          <span className="text-[9px] uppercase tracking-[0.35em] text-rose-400">
            // SURVIVOR
          </span>
        </div>
      </div>

      <div
        className={`absolute pointer-events-none ${
          compact
            ? "top-2 left-1/2 -translate-x-1/2"
            : "top-12 sm:top-14 left-3 sm:left-4"
        }`}
      >
        <div className={`flex gap-1.5 ${compact ? "flex-row" : "flex-col"}`}>
          <StatPill
            label="HP"
            value={
              snapshot.selfAlive
                ? Math.ceil(snapshot.selfHp).toString()
                : "00"
            }
            tone={
              snapshot.selfHp > 40
                ? "ok"
                : snapshot.selfHp > 15
                ? "warn"
                : "danger"
            }
          />
          <StatPill label="K" value={snapshot.selfKills.toString()} tone="ok" />
          <StatPill
            label="LIVE"
            value={snapshot.aliveCount.toString()}
            tone="ok"
          />
          {snapshot.status === "PLAYING" && (
            <StatPill
              label="TIDE"
              value={`${Math.round(snapshot.zoneShrink01 * 100)}%`}
              tone={snapshot.zoneShrink01 > 0.6 ? "danger" : snapshot.zoneShrink01 > 0.3 ? "warn" : "ok"}
            />
          )}
        </div>
      </div>

      {snapshot.selfAlive && (
        <div
          className={`absolute pointer-events-none ${
            compact
              ? "top-11 left-1/2 -translate-x-1/2"
              : "top-12 sm:top-14 left-24 sm:left-28"
          }`}
        >
          <div
            className="border border-white/40 bg-black/55 px-2 py-1 min-w-[140px]"
            style={{ fontFamily: MONO_FONT }}
          >
            <div className="flex items-baseline gap-2">
              <span className="text-[9px] tracking-[0.35em] text-white/60">
                WPN
              </span>
              <span
                className="text-[11px] tracking-[0.2em] font-bold"
                style={{ color: weaponColor.core }}
              >
                {weaponColor.label}
              </span>
              {snapshot.selfWeaponExpiresAtMs > 0 && (
                <span className="text-[9px] text-white/50 ml-auto">
                  {Math.ceil(weaponRemainingMs / 1000)}s
                </span>
              )}
            </div>
            {snapshot.selfWeaponExpiresAtMs > 0 && (
              <div className="h-[3px] bg-white/15 mt-1 relative">
                <div
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: `${weaponDrainPct * 100}%`,
                    background: weaponColor.core,
                    transition: "width 100ms linear",
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 pointer-events-none flex flex-col items-end gap-2">
        <div className="text-right">
          <div className="text-[9px] tracking-[0.35em] uppercase bg-white text-black px-2 py-0.5 inline-block font-bold">
            MATCH TIME
          </div>
          <p
            className="text-2xl sm:text-3xl font-bold tabular-nums mt-0.5"
            style={{ fontFamily: MONO_FONT }}
          >
            {timerText || "—"}
          </p>
        </div>
        {killFeed.length > 0 && (
          <div
            className="flex flex-col items-end gap-1 mt-2"
            style={{ fontFamily: MONO_FONT }}
          >
            {killFeed.map((k) => (
              <div
                key={k.id}
                className="bg-black/60 border-l-2 border-rose-400 px-2 py-0.5"
              >
                <span className="text-[10px] text-white">{k.killer}</span>
                <span className="text-[10px] text-rose-400 mx-1">▸</span>
                <span className="text-[10px] text-white/60">{k.victim}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {pickupToast && (
        <div
          className={`absolute inset-x-0 flex justify-center pointer-events-none ${
            compact ? "bottom-44" : "bottom-16"
          }`}
        >
          <div
            className="border-2 px-4 py-2 bg-black/80 backdrop-blur-sm"
            style={{
              borderColor:
                (WEAPON_COLORS[pickupToast.kind] ?? WEAPON_COLORS.pistol).core,
              fontFamily: MONO_FONT,
            }}
          >
            <p className="text-[9px] tracking-[0.35em] uppercase text-white/60">
              ▸ Acquired
            </p>
            <p
              className="text-base font-bold tracking-[0.2em] uppercase"
              style={{
                color:
                  (WEAPON_COLORS[pickupToast.kind] ?? WEAPON_COLORS.pistol)
                    .core,
              }}
            >
              {(WEAPON_COLORS[pickupToast.kind] ?? WEAPON_COLORS.pistol).label}
            </p>
          </div>
        </div>
      )}

      {snapshot.status === "ENDED" && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 pointer-events-auto">
          <div className="max-w-md text-center space-y-4">
            <div className="inline-block border-2 border-rose-400 px-3 py-1 mb-2">
              <p
                className="text-[10px] uppercase tracking-[0.35em] text-rose-400 font-bold"
                style={{ fontFamily: MONO_FONT }}
              >
                Match over
              </p>
            </div>
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

      {snapshot.status === "PLAYING" && !snapshot.selfAlive && (
        <div className="absolute inset-x-0 bottom-6 flex justify-center pointer-events-none">
          <p
            className="text-xs uppercase tracking-[0.25em] text-rose-400 bg-black/60 px-4 py-2 border border-rose-400/30"
            style={{ fontFamily: MONO_FONT }}
          >
            Spectating
          </p>
        </div>
      )}
    </>
  );
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "danger";
}) {
  const accent =
    tone === "danger" ? "#f87171" : tone === "warn" ? "#fbbf24" : "#22d3ee";
  return (
    <div
      className="inline-flex items-baseline gap-1.5 border border-white/30 bg-black/55 px-2 py-0.5"
      style={{ fontFamily: MONO_FONT }}
    >
      <span className="text-[9px] tracking-[0.35em] text-white/55">
        {label}
      </span>
      <span
        className="text-sm font-bold tabular-nums leading-none"
        style={{ color: accent }}
      >
        {value}
      </span>
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
  if (typeof players?.get === "function") {
    return players.get(sessionId) ?? null;
  }
  let found: ServerPlayer | null = null;
  players?.forEach?.((p, k) => {
    if (!found && k === sessionId) found = p;
  });
  return found;
}

function snapshotStatus(room: Room) {
  const empty = {
    status: "WAITING" as ServerState["status"],
    aliveCount: 0,
    selfAlive: false,
    selfHp: 0,
    selfKills: 0,
    selfPlacement: 0,
    selfWeapon: "pistol",
    selfWeaponExpiresAtMs: 0,
    matchEndsAtMs: 0,
    countdownEndsAtMs: 0,
    startedAtMs: 0,
    zoneShrink01: 0,
  };
  try {
    const rs = room.state as unknown as ServerState | undefined;
    if (!rs || !rs.players || typeof rs.players.forEach !== "function") {
      return empty;
    }
    let aliveCount = 0;
    rs.players.forEach((p: ServerPlayer) => {
      if (p?.alive) aliveCount++;
    });
    const self = lookupPlayer(rs, room.sessionId);
    return {
      status: rs.status ?? "WAITING",
      aliveCount,
      selfAlive: self?.alive ?? false,
      selfHp: self?.hp ?? 0,
      selfKills: self?.kills ?? 0,
      selfPlacement: self?.placement ?? 0,
      selfWeapon: self?.weapon ?? "pistol",
      selfWeaponExpiresAtMs: self?.weaponExpiresAtMs ?? 0,
      matchEndsAtMs: rs.matchEndsAtMs ?? 0,
      countdownEndsAtMs: rs.countdownEndsAtMs ?? 0,
      startedAtMs: rs.startedAtMs ?? 0,
      zoneShrink01:
        typeof (rs as { zoneShrink01?: number }).zoneShrink01 === "number"
          ? (rs as { zoneShrink01: number }).zoneShrink01
          : 0,
    };
  } catch {
    return empty;
  }
}

function bulletKey(b: ServerBullet, idx: number): string {
  // Bullets have no inherent id in the schema; we synthesise one from
  // (owner, spawn time, index) which is stable enough across a few ticks.
  return `${b.ownerId}|${b.spawnedAt}|${idx}`;
}

function interpPlayer(
  pair: { prev: PlayerSnap; curr: PlayerSnap } | undefined
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

function shortestAngleLerp(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return a + diff * t;
}

function computeWorldScale(cssW: number, cssH: number): number {
  const viewSpan = 1400;
  return Math.min(cssW, cssH) / viewSpan;
}

interface RenderCtx {
  playerBuf: PlayerBuffer;
  bulletBuf: BulletBuffer;
  shake: { amount: number; until: number };
  now: number;
  matchClock: {
    startedAtMs: number;
    matchEndsAtMs: number;
    zoneShrink01: number;
  };
}

/** Beach radius from synced zoneShrink01 (primary) or match clock fallback. */
function computeVisualZoneRadius(
  zone: ServerZone,
  zoneShrink01: number,
  startedAtMs: number,
  matchEndsAtMs: number
): number {
  if (typeof zoneShrink01 === "number" && zoneShrink01 >= 0 && zoneShrink01 <= 1) {
    return (
      ZONE_START_RADIUS +
      (ZONE_END_RADIUS - ZONE_START_RADIUS) * zoneShrink01
    );
  }
  if (startedAtMs > 0 && matchEndsAtMs > startedAtMs) {
    const total = matchEndsAtMs - startedAtMs;
    const elapsed = Math.max(0, Math.min(total, Date.now() - startedAtMs));
    const t = elapsed / total;
    return ZONE_START_RADIUS + (ZONE_END_RADIUS - ZONE_START_RADIUS) * t;
  }
  if (typeof zone?.radius === "number" && zone.radius > 0) return zone.radius;
  return ZONE_START_RADIUS;
}

/** Colyseus ArraySchema / plain array iteration. */
function iterateSchemaArray<T>(arr: unknown, fn: (item: T) => void): void {
  if (arr == null) return;
  const schema = arr as {
    forEach?: (cb: (item: T) => void) => void;
    length?: number;
    size?: number;
  };
  if (typeof schema.forEach === "function") {
    schema.forEach(fn);
    return;
  }
  const len = schema.length ?? schema.size ?? 0;
  for (let i = 0; i < len; i++) {
    const item = (arr as Record<number, T>)[i];
    if (item != null) fn(item);
  }
}

function renderFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  rs: ServerState,
  selfId: string,
  cam: { x: number; y: number },
  rctx: RenderCtx
) {
  if (!rs || !rs.players || typeof rs.players.forEach !== "function") return;

  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.width / dpr;
  const cssH = canvas.height / dpr;
  const now = rctx.now;

  // Screen-shake offset.
  let shakeX = 0;
  let shakeY = 0;
  if (rctx.shake.until > now) {
    const remaining = (rctx.shake.until - now) / 220;
    const amt = rctx.shake.amount * remaining;
    shakeX = (Math.random() - 0.5) * amt * 2;
    shakeY = (Math.random() - 0.5) * amt * 2;
  }

  ctx.save();
  ctx.scale(dpr, dpr);

  // Deep ocean fills the viewport; sand island is drawn in world space.
  const ocean = ctx.createLinearGradient(0, 0, 0, cssH);
  ocean.addColorStop(0, "#0a2a4a");
  ocean.addColorStop(1, "#061525");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, cssW, cssH);

  const scale = computeWorldScale(cssW, cssH);
  const screenCx = cssW / 2 + shakeX;
  const screenCy = cssH / 2 + shakeY;
  const camX = cam.x;
  const camY = cam.y;

  const w2s = (x: number, y: number) => ({
    sx: (x - camX) * scale + screenCx,
    sy: (y - camY) * scale + screenCy,
  });

  const zone = rs.zone ?? {
    cx: 0,
    cy: 0,
    radius: ZONE_START_RADIUS,
    targetRadius: ZONE_END_RADIUS,
  };
  const shrink01 =
    typeof (rs as { zoneShrink01?: number }).zoneShrink01 === "number"
      ? (rs as { zoneShrink01: number }).zoneShrink01
      : rctx.matchClock.zoneShrink01;
  const beachRadius = computeVisualZoneRadius(
    zone,
    shrink01,
    rctx.matchClock.startedAtMs,
    rctx.matchClock.matchEndsAtMs
  );
  const zoneVisual: ServerZone = { ...zone, radius: beachRadius };

  drawOcean(ctx, cssW, cssH);
  drawBeach(ctx, zoneVisual, w2s, scale);
  drawGrid(ctx, w2s, scale, cssW, cssH, camX, camY, zoneVisual);

  iterateSchemaArray<ServerObstacle>(rs.obstacles, (o) => {
    drawObstacle(ctx, o, w2s, scale);
  });

  drawCreepingWater(ctx, zoneVisual, w2s, scale, cssW, cssH, now);
  drawZoneRings(ctx, zoneVisual, w2s, scale, now);

  if (rs.pickups && typeof (rs.pickups as { forEach?: unknown }).forEach === "function") {
    (rs.pickups as unknown as {
      forEach: (cb: (p: ServerPickup) => void) => void;
    }).forEach((pu) => {
      drawPickup(ctx, pu, w2s, scale, now);
    });
  }

  drawBullets(ctx, w2s, scale, now, rctx.bulletBuf);

  rs.players.forEach((p: ServerPlayer, sessionId: string) => {
    const buf = rctx.playerBuf.get(sessionId);
    const lerp =
      interpPlayer(buf) ?? {
        x: p.x ?? 0,
        y: p.y ?? 0,
        aim: p.aim ?? 0,
      };
    drawPlayer(ctx, p, sessionId === selfId, lerp, w2s, scale, now);
  });

  ctx.restore();
}

function drawOcean(ctx: CanvasRenderingContext2D, cssW: number, cssH: number) {
  const ocean = ctx.createLinearGradient(0, 0, 0, cssH);
  ocean.addColorStop(0, "#0c4a6e");
  ocean.addColorStop(0.5, "#0e7490");
  ocean.addColorStop(1, "#082f49");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, cssW, cssH);
}

/** Sand beach = current safe zone (follows the player camera). */
function drawBeach(
  ctx: CanvasRenderingContext2D,
  zone: ServerZone,
  w2s: (x: number, y: number) => { sx: number; sy: number },
  scale: number
) {
  const cx = zone.cx ?? 0;
  const cy = zone.cy ?? 0;
  const centre = w2s(cx, cy);
  const r = zone.radius * scale;

  const sand = ctx.createRadialGradient(
    centre.sx,
    centre.sy,
    r * 0.1,
    centre.sx,
    centre.sy,
    r
  );
  sand.addColorStop(0, "#f5e6c8");
  sand.addColorStop(0.45, "#e8c992");
  sand.addColorStop(0.75, "#d4a96a");
  sand.addColorStop(1, "#c49558");
  ctx.fillStyle = sand;
  ctx.beginPath();
  ctx.arc(centre.sx, centre.sy, r, 0, Math.PI * 2);
  ctx.fill();

  // Wet sand ring at the water line.
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = Math.max(2, 3 * scale);
  ctx.beginPath();
  ctx.arc(centre.sx, centre.sy, Math.max(0, r - 3 * scale), 0, Math.PI * 2);
  ctx.stroke();
}

/** Danger water overlay outside the beach + animated wave crest on the boundary. */
function drawCreepingWater(
  ctx: CanvasRenderingContext2D,
  zone: ServerZone,
  w2s: (x: number, y: number) => { sx: number; sy: number },
  scale: number,
  cssW: number,
  cssH: number,
  now: number
) {
  const cx = zone.cx ?? 0;
  const cy = zone.cy ?? 0;
  const centre = w2s(cx, cy);
  const r = zone.radius * scale;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, cssW, cssH);
  ctx.arc(centre.sx, centre.sy, r, 0, Math.PI * 2, true);
  ctx.closePath();
  const water = ctx.createLinearGradient(0, 0, 0, cssH);
  water.addColorStop(0, "rgba(14,116,144,0.55)");
  water.addColorStop(1, "rgba(7,89,133,0.7)");
  ctx.fillStyle = water;
  ctx.fill("evenodd");
  ctx.restore();

  // Animated wave line along the shrinking edge.
  const segments = 72;
  const waveAmp = Math.max(4, 10 * scale);
  ctx.save();
  ctx.strokeStyle = "rgba(186,230,253,0.85)";
  ctx.lineWidth = Math.max(2, 2.5 * scale);
  ctx.shadowColor = "rgba(56,189,248,0.6)";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const ang = (i / segments) * Math.PI * 2;
    const wobble =
      Math.sin(ang * 6 + now * 0.005) * waveAmp +
      Math.sin(ang * 3 - now * 0.003) * (waveAmp * 0.4);
    const dist = zone.radius + wobble / scale;
    const wx = cx + Math.cos(ang) * dist;
    const wy = cy + Math.sin(ang) * dist;
    const p = w2s(wx, wy);
    if (i === 0) ctx.moveTo(p.sx, p.sy);
    else ctx.lineTo(p.sx, p.sy);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  w2s: (x: number, y: number) => { sx: number; sy: number },
  scale: number,
  cssW: number,
  cssH: number,
  camX: number,
  camY: number,
  zone: ServerZone
) {
  const half = WORLD / 2;
  const minorStep = 100;
  const majorStep = 400;
  const visibleSpan = Math.max(cssW, cssH) / scale + minorStep * 2;

  const zcx = zone.cx ?? 0;
  const zcy = zone.cy ?? 0;
  const zr = zone.radius;
  const beachCentre = w2s(zcx, zcy);
  const beachR = zr * scale;

  ctx.save();
  ctx.beginPath();
  ctx.arc(beachCentre.sx, beachCentre.sy, beachR, 0, Math.PI * 2);
  ctx.clip();

  const startX = Math.max(
    -half,
    Math.floor((camX - visibleSpan / 2) / minorStep) * minorStep
  );
  const endX = Math.min(
    half,
    Math.ceil((camX + visibleSpan / 2) / minorStep) * minorStep
  );
  const startY = Math.max(
    -half,
    Math.floor((camY - visibleSpan / 2) / minorStep) * minorStep
  );
  const endY = Math.min(
    half,
    Math.ceil((camY + visibleSpan / 2) / minorStep) * minorStep
  );

  // Minor sand grain lines.
  ctx.strokeStyle = "rgba(139,94,60,0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = startX; x <= endX; x += minorStep) {
    if (x % majorStep === 0) continue;
    const a = w2s(x, startY);
    const b = w2s(x, endY);
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
  }
  for (let y = startY; y <= endY; y += minorStep) {
    if (y % majorStep === 0) continue;
    const a = w2s(startX, y);
    const b = w2s(endX, y);
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
  }
  ctx.stroke();

  // Major paths (darker sand tracks).
  ctx.strokeStyle = "rgba(120,78,45,0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = startX; x <= endX; x += minorStep) {
    if (x % majorStep !== 0) continue;
    const a = w2s(x, startY);
    const b = w2s(x, endY);
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
  }
  for (let y = startY; y <= endY; y += minorStep) {
    if (y % majorStep !== 0) continue;
    const a = w2s(startX, y);
    const b = w2s(endX, y);
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
  }
  ctx.stroke();
  ctx.restore();
}

function drawZoneRings(
  ctx: CanvasRenderingContext2D,
  zone: ServerZone,
  w2s: (x: number, y: number) => { sx: number; sy: number },
  scale: number,
  now: number
) {
  if (!zone || typeof zone.radius !== "number") return;
  const cx = zone.cx ?? 0;
  const cy = zone.cy ?? 0;
  const zc = w2s(cx, cy);
  const r = zone.radius * scale;
  const waveAmp = Math.max(3, 6 * scale);

  ctx.save();
  ctx.strokeStyle = "rgba(251,191,36,0.65)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  const innerSegs = 48;
  for (let i = 0; i <= innerSegs; i++) {
    const ang = (i / innerSegs) * Math.PI * 2;
    const wobble = Math.sin(ang * 4 + now * 0.004) * (waveAmp * 0.5);
    const p = w2s(
      cx + Math.cos(ang) * (zone.radius - 12 + wobble / scale),
      cy + Math.sin(ang) * (zone.radius - 12 + wobble / scale)
    );
    if (i === 0) ctx.moveTo(p.sx, p.sy);
    else ctx.lineTo(p.sx, p.sy);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawBullets(
  ctx: CanvasRenderingContext2D,
  w2s: (x: number, y: number) => { sx: number; sy: number },
  scale: number,
  now: number,
  buf: BulletBuffer
) {
  if (!buf || buf.size === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  buf.forEach((b) => {
    const dt = (now - b.t) / 1000;
    const x = b.x + b.vx * dt;
    const y = b.y + b.vy * dt;
    const pos = w2s(x, y);
    const color = WEAPON_COLORS[b.kind] ?? WEAPON_COLORS.pistol;
    const innerR = Math.max(2, BULLET_R * scale);
    const outerR = innerR * 3;

    ctx.fillStyle = color.glow;
    ctx.beginPath();
    ctx.arc(pos.sx, pos.sy, outerR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color.core;
    ctx.beginPath();
    ctx.arc(pos.sx, pos.sy, innerR, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawObstacle(
  ctx: CanvasRenderingContext2D,
  o: ServerObstacle,
  w2s: (x: number, y: number) => { sx: number; sy: number },
  scale: number
) {
  const kind = o.kind;
  if (kind === "gorilla" || kind === "flower") {
    drawSpriteObstacle(ctx, o, w2s, scale, kind);
  } else if (kind === "cliff" || kind === "wall") {
    drawCliff(ctx, o, w2s, scale);
  } else if (kind === "palm" || kind === "crate") {
    drawPixelPalm(ctx, o, w2s, scale);
  } else if (kind === "wreck" || kind === "pallet") {
    drawWreck(ctx, o, w2s, scale);
  } else {
    drawRock(ctx, o, w2s, scale);
  }
}

function drawSpriteObstacle(
  ctx: CanvasRenderingContext2D,
  o: ServerObstacle,
  w2s: (x: number, y: number) => { sx: number; sy: number },
  scale: number,
  kind: string
) {
  const tl = w2s(o.x - o.w / 2, o.y - o.h / 2);
  const w = o.w * scale;
  const h = o.h * scale;
  const img = obstacleSpriteCache.get(kind);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, tl.sx, tl.sy, w, h);
  } else {
    ctx.fillStyle = kind === "flower" ? "#f472b6" : "#78716c";
    ctx.fillRect(tl.sx, tl.sy, w, h);
    ctx.strokeStyle = "#fff";
    ctx.strokeRect(tl.sx, tl.sy, w, h);
  }
  ctx.restore();
}

/** Rocky cliff segment — maze walls on the island. */
function drawCliff(
  ctx: CanvasRenderingContext2D,
  o: ServerObstacle,
  w2s: (x: number, y: number) => { sx: number; sy: number },
  scale: number
) {
  const tl = w2s(o.x - o.w / 2, o.y - o.h / 2);
  const w = o.w * scale;
  const h = o.h * scale;
  const horizontal = o.w >= o.h;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(tl.sx + 3, tl.sy + 5, w, h);

  const grad = ctx.createLinearGradient(
    tl.sx,
    tl.sy,
    horizontal ? tl.sx + w : tl.sx,
    horizontal ? tl.sy : tl.sy + h
  );
  grad.addColorStop(0, "#6b7280");
  grad.addColorStop(0.5, "#4b5563");
  grad.addColorStop(1, "#374151");
  ctx.fillStyle = grad;
  ctx.fillRect(tl.sx, tl.sy, w, h);

  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = Math.max(1, 1.2 * scale);
  ctx.strokeRect(tl.sx, tl.sy, w, h);

  // Moss highlight on top edge.
  ctx.fillStyle = "rgba(74,222,128,0.25)";
  ctx.fillRect(tl.sx, tl.sy, w, Math.max(3, h * 0.15));

  ctx.restore();
}

/** Small boulder. */
function drawRock(
  ctx: CanvasRenderingContext2D,
  o: ServerObstacle,
  w2s: (x: number, y: number) => { sx: number; sy: number },
  scale: number
) {
  const centre = w2s(o.x, o.y);
  const rx = (o.w / 2) * scale;
  const ry = (o.h / 2) * scale;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(centre.sx + 3, centre.sy + 5, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  const grad = ctx.createRadialGradient(
    centre.sx - rx * 0.3,
    centre.sy - ry * 0.3,
    2,
    centre.sx,
    centre.sy,
    Math.max(rx, ry)
  );
  grad.addColorStop(0, "#9ca3af");
  grad.addColorStop(1, "#4b5563");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(centre.sx, centre.sy, rx, ry, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

/** Chunky pixel-art palm tree. */
function drawPixelPalm(
  ctx: CanvasRenderingContext2D,
  o: ServerObstacle,
  w2s: (x: number, y: number) => { sx: number; sy: number },
  scale: number
) {
  const base = w2s(o.x, o.y + o.h * 0.12);
  const px = Math.max(3, Math.floor(4 * scale));
  const trunkW = Math.max(px * 2, Math.floor(o.w * scale * 0.35));
  const trunkH = Math.max(px * 5, Math.floor(o.h * scale * 0.55));

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(base.sx - trunkW / 2 + px, base.sy - trunkH / 2 + px, trunkW, trunkH);

  for (let ty = 0; ty < trunkH; ty += px) {
    for (let tx = 0; tx < trunkW; tx += px) {
      ctx.fillStyle = (tx + ty) % (px * 2) === 0 ? "#78350f" : "#92400e";
      ctx.fillRect(base.sx - trunkW / 2 + tx, base.sy - trunkH / 2 + ty, px, px);
    }
  }

  const frondColors = ["#15803d", "#16a34a", "#22c55e", "#14532d"];
  const frondLen = Math.max(px * 4, Math.floor(o.w * scale * 1.2));
  const topY = base.sy - trunkH / 2 - px;
  const dirs: Array<[number, number]> = [
    [0, -1],
    [0.7, -0.7],
    [1, 0],
    [0.7, 0.7],
    [0, 1],
    [-0.7, 0.7],
    [-1, 0],
    [-0.7, -0.7],
  ];
  dirs.forEach(([dx, dy], i) => {
    ctx.fillStyle = frondColors[i % frondColors.length];
    for (let step = 0; step < frondLen; step += px) {
      const fx = base.sx + dx * step;
      const fy = topY + dy * step;
      ctx.fillRect(fx, fy, px, px);
      if (step > px * 2) {
        ctx.fillRect(fx + px * dy, fy + px * dx, px, px);
      }
    }
  });

  ctx.fillStyle = "#166534";
  ctx.fillRect(base.sx - px * 2, topY - px, px * 4, px * 3);
  ctx.restore();
}

/** Driftwood / wreckage barricade. */
function drawWreck(
  ctx: CanvasRenderingContext2D,
  o: ServerObstacle,
  w2s: (x: number, y: number) => { sx: number; sy: number },
  scale: number
) {
  const tl = w2s(o.x - o.w / 2, o.y - o.h / 2);
  const w = o.w * scale;
  const h = o.h * scale;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(tl.sx + 3, tl.sy + 5, w, h);

  const grad = ctx.createLinearGradient(tl.sx, tl.sy, tl.sx + w, tl.sy + h);
  grad.addColorStop(0, "#92400e");
  grad.addColorStop(0.5, "#78350f");
  grad.addColorStop(1, "#451a03");
  ctx.fillStyle = grad;
  ctx.fillRect(tl.sx, tl.sy, w, h);

  ctx.strokeStyle = "rgba(254,243,199,0.35)";
  ctx.lineWidth = Math.max(1, 1.5 * scale);
  ctx.strokeRect(tl.sx + 1, tl.sy + 1, w - 2, h - 2);

  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.moveTo(tl.sx + w * 0.2, tl.sy);
  ctx.lineTo(tl.sx + w * 0.8, tl.sy + h);
  ctx.moveTo(tl.sx + w * 0.7, tl.sy);
  ctx.lineTo(tl.sx + w * 0.1, tl.sy + h);
  ctx.stroke();

  ctx.restore();
}

function drawPickup(
  ctx: CanvasRenderingContext2D,
  pu: ServerPickup,
  w2s: (x: number, y: number) => { sx: number; sy: number },
  scale: number,
  now: number
) {
  const pos = w2s(pu.x, pu.y);
  const color = WEAPON_COLORS[pu.kind] ?? WEAPON_COLORS.pistol;
  const bob = Math.sin(now / 350 + pu.x * 0.01) * 3;
  const rot = ((now / 1200) % (Math.PI * 2)) + (pu.x + pu.y) * 0.001;
  const size = Math.max(14, PICKUP_R * scale * 1.4);

  ctx.save();
  ctx.translate(pos.sx, pos.sy + bob);
  ctx.rotate(rot);

  ctx.shadowColor = color.glow;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = color.core;
  ctx.lineWidth = 2.5;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.rect(-size / 2, -size / 2, size, size);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.rotate(-rot);
  ctx.fillStyle = color.core;
  ctx.font = `bold ${Math.max(10, size * 0.65)}px ${MONO_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const letter =
    pu.kind === "health"
      ? "H"
      : pu.kind === "shotgun"
      ? "S"
      : pu.kind === "rapid"
      ? "R"
      : pu.kind === "sniper"
      ? "X"
      : "?";
  ctx.fillText(letter, 0, 1);
  ctx.restore();
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  p: ServerPlayer,
  isSelf: boolean,
  pos: { x: number; y: number; aim: number },
  w2s: (x: number, y: number) => { sx: number; sy: number },
  scale: number,
  now: number
) {
  const screen = w2s(pos.x, pos.y);
  const r = PLAYER_R * scale;

  ctx.save();
  if (!p.alive) ctx.globalAlpha = 0.28;

  // Drop shadow.
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(
    screen.sx,
    screen.sy + r * 0.4,
    r * 0.95,
    r * 0.35,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();

  // Body (squircle).
  const bodyColor = isSelf ? "#22d3ee" : "#f0abfc";
  const strokeColor = isSelf ? "#0e7490" : "#a21caf";
  ctx.fillStyle = bodyColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = Math.max(2, 2.5 * scale);
  const side = r * 1.8;
  roundRect(
    ctx,
    screen.sx - side / 2,
    screen.sy - side / 2,
    side,
    side,
    r * 0.45
  );
  ctx.fill();
  ctx.stroke();

  // Gun barrel (weapon-tinted).
  if (p.alive) {
    const weapon = (p.weapon || "pistol").toLowerCase();
    const wcolor = WEAPON_COLORS[weapon] ?? WEAPON_COLORS.pistol;
    ctx.save();
    ctx.strokeStyle = wcolor.core;
    ctx.shadowColor = wcolor.glow;
    ctx.shadowBlur = 8;
    ctx.lineWidth = Math.max(2.5, 5 * scale);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(screen.sx, screen.sy);
    ctx.lineTo(
      screen.sx + Math.cos(pos.aim) * (r + 14),
      screen.sy + Math.sin(pos.aim) * (r + 14)
    );
    ctx.stroke();
    ctx.restore();
  }

  // HP bar with bracket ticks.
  if (p.alive) {
    const barW = Math.max(30, r * 2.3);
    const barH = 4;
    const bx = screen.sx - barW / 2;
    const by = screen.sy - r - 14;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(bx, by, barW, barH);
    const pct = Math.max(0, Math.min(1, p.hp / 100));
    ctx.fillStyle = p.hp > 40 ? "#34d399" : p.hp > 15 ? "#fbbf24" : "#f87171";
    ctx.fillRect(bx, by, barW * pct, barH);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx - 2, by - 1);
    ctx.lineTo(bx - 2, by + barH + 1);
    ctx.moveTo(bx + barW + 2, by - 1);
    ctx.lineTo(bx + barW + 2, by + barH + 1);
    ctx.stroke();
  }

  // Weapon timer arc.
  if (p.alive && p.weaponExpiresAtMs > 0) {
    const remaining = Math.max(0, p.weaponExpiresAtMs - now);
    const pct = Math.max(0, Math.min(1, remaining / WEAPON_BUFF_MS));
    const ringR = r + 6;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(
      screen.sx,
      screen.sy,
      ringR,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * pct,
      false
    );
    ctx.stroke();
    ctx.restore();
  }

  // Display name.
  ctx.globalAlpha = p.alive ? 0.92 : 0.35;
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.max(10, 11 * Math.min(1.6, scale))}px ${MONO_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(p.displayName.toUpperCase(), screen.sx, screen.sy - r - 20);

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}
