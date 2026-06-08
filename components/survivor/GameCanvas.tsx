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
import { MusicMuteButton } from "./SurvivorMusic";
import SlimeAvatar, { drawSlime } from "./SlimeAvatar";
import { SURVIVOR_MAX_PLAYERS } from "@/lib/survivor-config";
import { DEFAULT_NAME_COLOR, DEFAULT_SLIME_COLOR, parseNameColor, parseNameBadge, parseNameOutline, parseSlimeFace, parseSlimeHeadAccessory, parseSlimeBodyAccessory, NAME_BADGES, NAME_OUTLINE_GLOW, NAME_OUTLINE_HEAVY } from "@/lib/survivor-slime";

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
  lastShotAt: number;
  radiusScale: number;
  speedScale: number;
  maxHp: number;
  burnUntilMs: number;
  frozenUntilMs: number;
  slimeColor: string;
  slimeFace: number;
  slimeAccessories: number;
  slimeHeadAccessory: number;
  slimeBodyAccessory: number;
  nameColor: string;
  nameOutline: number;
  nameBadge: number;
  towerBuffExpiresAtMs: number;
  towerBuffKind: string;
  extraLives: number;
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

interface ServerBoss {
  id: string;
  kind: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  slimeColor: string;
  slimeFace: number;
  nextJumpAtMs: number;
  jumpLandAtMs: number;
  aim: number;
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
  bosses?: ServerBoss[] | { forEach: (cb: (b: ServerBoss) => void) => void; length: number };
  zone: ServerZone;
  activeTowerKind?: string;
  activeBonusKind?: string;
  towerCycleEndsAtMs?: number;
}

// Must match game-server/src/constants.ts.
const WORLD = 4000;
const ZONE_START_RADIUS = 2700;
const ZONE_END_RADIUS = 450;
const PLAYER_R = 18;
const BULLET_R = 4;
const PICKUP_R = 14;

// Render one or two patches behind so we always have a "next" snapshot to
// lerp toward even under packet jitter. Server patches every ~33ms now, so
// 130ms is ~4 patches of buffer — plenty of headroom without feeling laggy.
const INTERP_DELAY_MS = 130;
const WEAPON_BUFF_MS = 20_000;
const TOWER_BUFF_RADIUS = 250;
const METEOR_WARNING_MS = 2800;
const METEOR_CRATER_LINGER_MS = 14_000;
const VOLCANO_LAVA_RADIUS = 210;
const BOSS_TRAIL_LINGER_MS = 6_000;
const BOSS_TRAIL_RADIUS = 40;

const TOWER_BONUS_LABELS: Record<string, string> = {
  pistol: "pistol",
  shotgun: "shotgun",
  rapid: "rapid fire",
  sniper: "sniper",
  ice_bow: "ice bow",
  flamethrower: "flamethrower",
  rocket: "rocket launcher",
};

const TOWER_BONUS_RING_COLORS: Record<string, string> = {
  pistol: "rgba(245,245,245,0.75)",
  shotgun: "rgba(251,191,36,0.8)",
  rapid: "rgba(52,211,153,0.75)",
  sniper: "rgba(248,113,113,0.75)",
  ice_bow: "rgba(103,232,249,0.8)",
  flamethrower: "rgba(251,146,60,0.85)",
  rocket: "rgba(239,68,68,0.85)",
};

const OBSTACLE_SPRITE_URLS: Record<string, string> = {
  gorilla: "/survivor/obstacles/gorilla.png",
  flower: "/survivor/obstacles/flower.png",
  tower_kt_corp: "/survivor/buildings/tower_kt_corp.png",
  tower_dan_sporting: "/survivor/buildings/tower_dan_sporting.png",
  tower_horizon: "/survivor/buildings/tower_horizon.png",
  tower_goat: "/survivor/buildings/tower_goat.png",
  tower_src: "/survivor/buildings/tower_src.png",
  tower_pax: "/survivor/buildings/tower_pax.png",
  tower_internet_money: "/survivor/buildings/tower_internet_money.png",
  tower_tomy: "/survivor/buildings/tower_tomy.png",
  tower_ror_sply: "/survivor/buildings/tower_ror_sply.png",
  tower_gus_supply: "/survivor/buildings/tower_gus_supply.png",
};
/** Black-backed PNGs are keyed out at load time so only the art shows on sand. */
const SPRITE_BLACK_KEY_THRESHOLD = 16;
const obstacleSpriteCache = new Map<string, HTMLCanvasElement>();

function isSpriteBackgroundPixel(
  r: number,
  g: number,
  b: number,
  kind: string
): boolean {
  if (
    r <= SPRITE_BLACK_KEY_THRESHOLD &&
    g <= SPRITE_BLACK_KEY_THRESHOLD &&
    b <= SPRITE_BLACK_KEY_THRESHOLD
  ) {
    return true;
  }
  // Vendor tower exports often use a grey/white checkerboard instead of black.
  if (kind.startsWith("tower_")) {
    const neutral =
      Math.abs(r - g) <= 12 &&
      Math.abs(g - b) <= 12 &&
      Math.abs(r - b) <= 12;
    if (neutral && r >= 168 && g >= 168 && b >= 168) {
      return true;
    }
  }
  return false;
}

function processObstacleSprite(
  img: HTMLImageElement,
  kind: string
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    if (isSpriteBackgroundPixel(r, g, b, kind)) {
      d[i + 3] = 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function preloadObstacleSprites(): void {
  for (const [kind, src] of Object.entries(OBSTACLE_SPRITE_URLS)) {
    if (obstacleSpriteCache.has(kind)) continue;
    const img = new Image();
    img.src = src;
    img.onload = () => {
      obstacleSpriteCache.set(kind, processObstacleSprite(img, kind));
    };
  }
}

const WEAPON_COLORS: Record<string, { core: string; glow: string; label: string }> = {
  pistol: { core: "#f5f5f5", glow: "rgba(245,245,245,0.55)", label: "PISTOL" },
  shotgun: { core: "#fbbf24", glow: "rgba(251,191,36,0.55)", label: "SHOTGUN" },
  rapid: { core: "#34d399", glow: "rgba(52,211,153,0.55)", label: "RAPID" },
  sniper: { core: "#f87171", glow: "rgba(248,113,113,0.55)", label: "SNIPER" },
  ice_bow: { core: "#67e8f9", glow: "rgba(103,232,249,0.65)", label: "ICE BOW" },
  flamethrower: { core: "#fb923c", glow: "rgba(251,146,60,0.65)", label: "FLAMETHROWER" },
  rocket: { core: "#ef4444", glow: "rgba(239,68,68,0.65)", label: "ROCKET" },
  health: { core: "#4ade80", glow: "rgba(74,222,128,0.55)", label: "HEALTH" },
  mystery: { core: "#ff6eb4", glow: "rgba(255,110,180,0.55)", label: "MYSTERY" },
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
  const spectatorCamRef = useRef<{ x: number; y: number; ready: boolean }>({
    x: 0,
    y: 0,
    ready: false,
  });
  const lastSelfAliveRef = useRef(true);
  const shakeRef = useRef<{ amount: number; until: number }>({
    amount: 0,
    until: 0,
  });
  const explosionsRef = useRef<
    Array<{ x: number; y: number; radius: number; kind: string; expiresAt: number }>
  >([]);

  // Used to detect HP drops between snapshots so we can fire shake/flash.
  const lastSelfHpRef = useRef<number>(100);

  // Transient UI events surfaced via room.send (kill feed + pickup toast).
  const [killFeed, setKillFeed] = useState<
    Array<{ id: number; killer: string; victim: string; expiresAt: number }>
  >([]);
  const [pickupToast, setPickupToast] = useState<{
    kind: string;
    label: string;
    blurb: string;
    expiresAt: number;
  } | null>(null);
  const [towerAnnouncement, setTowerAnnouncement] = useState<{
    vendorName: string;
    bonusKind: string;
    expiresAt: number;
  } | null>(null);
  const [volcanoAnnouncement, setVolcanoAnnouncement] = useState<{
    message: string;
    expiresAt: number;
  } | null>(null);
  const [bossAnnouncement, setBossAnnouncement] = useState<{
    message: string;
    expiresAt: number;
  } | null>(null);
  const [lifeToast, setLifeToast] = useState<{
    title: string;
    message: string;
    expiresAt: number;
  } | null>(null);
  const meteorFxRef = useRef<
    Array<{
      x: number;
      y: number;
      radius: number;
      startMs: number;
      impactAtMs: number;
      craterUntilMs: number;
    }>
  >([]);
  const bossTrailFxRef = useRef<
    Array<{
      x: number;
      y: number;
      radius: number;
      expiresAtMs: number;
      color: string;
    }>
  >([]);

  // HUD-relevant fields sampled from state at React rate.
  const [statusSnapshot, setStatusSnapshot] = useState<
    ReturnType<typeof snapshotStatus>
  >(() => snapshotStatus(room));

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

          if (self.alive && !lastSelfAliveRef.current) {
            spectatorCamRef.current.ready = false;
          }
          if (!self.alive && lastSelfAliveRef.current) {
            const corpse = playerBufRef.current.get(sessionIdRef.current)?.curr;
            spectatorCamRef.current = {
              x: corpse?.x ?? self.x ?? cameraRef.current.x,
              y: corpse?.y ?? self.y ?? cameraRef.current.y,
              ready: true,
            };
          }
          lastSelfAliveRef.current = self.alive;
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
      const registry = room.onStateChange as unknown as {
        remove?: (fn: typeof cb) => void;
      };
      registry.remove?.(cb);
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
    const onPickup = (payload: {
      kind: string;
      label?: string;
      blurb?: string;
    }) => {
      if (!payload?.kind) return;
      setPickupToast({
        kind: payload.kind,
        label: payload.label ?? payload.kind,
        blurb: payload.blurb ?? "Mystery power-up unlocked.",
        expiresAt: Date.now() + 3200,
      });
    };
    const onTowerBonus = (payload: {
      vendorName: string;
      bonusKind: string;
    }) => {
      if (!payload?.vendorName || !payload?.bonusKind) return;
      setTowerAnnouncement({
        vendorName: payload.vendorName,
        bonusKind: payload.bonusKind,
        expiresAt: Date.now() + 6000,
      });
    };
    const onExplosions = (
      payload: Array<{ x: number; y: number; radius: number; kind: string }>
    ) => {
      if (!Array.isArray(payload) || payload.length === 0) return;
      const now = Date.now();
      explosionsRef.current = [
        ...explosionsRef.current,
        ...payload.map((e) => ({ ...e, expiresAt: now + 450 })),
      ].slice(-12);
    };
    const onVolcanoEruption = (payload: {
      message?: string;
      strikes?: Array<{
        x: number;
        y: number;
        radius: number;
        impactAtMs: number;
      }>;
    }) => {
      if (!payload?.strikes?.length) return;
      const now = Date.now();
      setVolcanoAnnouncement({
        message: payload.message ?? "The volcano is erupting!",
        expiresAt: now + 7000,
      });
      meteorFxRef.current = [
        ...meteorFxRef.current,
        ...payload.strikes.map((s) => ({
          x: s.x,
          y: s.y,
          radius: s.radius,
          startMs: now,
          impactAtMs: s.impactAtMs,
          craterUntilMs: s.impactAtMs + METEOR_CRATER_LINGER_MS,
        })),
      ].slice(-24);
    };
    const onBossSpawn = (payload: { message?: string }) => {
      const now = Date.now();
      setBossAnnouncement({
        message:
          payload.message ??
          "Giant slimes are stalking the island — slay one for an extra life!",
        expiresAt: now + 6500,
      });
    };
    const onBossTrails = (
      payload: Array<{
        x: number;
        y: number;
        radius: number;
        expiresAtMs: number;
        color: string;
      }>
    ) => {
      if (!Array.isArray(payload) || payload.length === 0) return;
      bossTrailFxRef.current = [...bossTrailFxRef.current, ...payload].slice(
        -48
      );
    };
    room.onMessage("event:kills", onKills);
    room.onMessage("event:pickup", onPickup);
    room.onMessage("event:tower-bonus", onTowerBonus);
    room.onMessage("event:volcano-eruption", onVolcanoEruption);
    room.onMessage("event:boss-spawn", onBossSpawn);
    room.onMessage("event:boss-trails", onBossTrails);
    room.onMessage("event:extra-life", (payload: { message?: string }) => {
      const now = Date.now();
      setLifeToast({
        title: "Extra life",
        message: payload.message ?? "Extra life earned!",
        expiresAt: now + 4500,
      });
      shakeRef.current = { amount: 6, until: now + 180 };
    });
    room.onMessage("event:respawn", (payload: { message?: string }) => {
      const now = Date.now();
      setLifeToast({
        title: "Respawn",
        message: payload.message ?? "Extra life used — you're back in!",
        expiresAt: now + 4500,
      });
      shakeRef.current = { amount: 10, until: now + 260 };
    });
    room.onMessage("event:explosions", onExplosions);
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
      setTowerAnnouncement((a) => (a && a.expiresAt > now ? a : null));
      setVolcanoAnnouncement((a) => (a && a.expiresAt > now ? a : null));
      setBossAnnouncement((a) => (a && a.expiresAt > now ? a : null));
      setLifeToast((t) => (t && t.expiresAt > now ? t : null));
      explosionsRef.current = explosionsRef.current.filter((e) => e.expiresAt > now);
      meteorFxRef.current = meteorFxRef.current.filter(
        (m) => m.craterUntilMs > now
      );
      bossTrailFxRef.current = bossTrailFxRef.current.filter(
        (t) => t.expiresAtMs > now
      );
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

      const rs = room.state as unknown as ServerState | undefined;
      if (!rs) {
        raf = window.requestAnimationFrame(draw);
        return;
      }

      const moveStick = moveStickRef.current;
      const self = lookupPlayer(rs, sessionIdRef.current);
      const isSpectating =
        rs.status === "PLAYING" && !!self && !self.alive;

      let moveX = 0;
      let moveY = 0;
      if (moveStick.active) {
        moveX = moveStick.moveX;
        moveY = moveStick.moveY;
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

      if (isSpectating) {
        inputRef.current.moveX = 0;
        inputRef.current.moveY = 0;
        inputRef.current.shooting = false;

        if (!spectatorCamRef.current.ready) {
          const corpse = interpPlayer(
            playerBufRef.current.get(sessionIdRef.current)
          );
          spectatorCamRef.current = {
            x: corpse?.x ?? cameraRef.current.x,
            y: corpse?.y ?? cameraRef.current.y,
            ready: true,
          };
        }

        const ghostSpeed = 340;
        const halfWorld = WORLD * 0.48;
        spectatorCamRef.current.x = clamp(
          spectatorCamRef.current.x + moveX * ghostSpeed * dt,
          -halfWorld,
          halfWorld
        );
        spectatorCamRef.current.y = clamp(
          spectatorCamRef.current.y + moveY * ghostSpeed * dt,
          -halfWorld,
          halfWorld
        );
        cameraRef.current.x = spectatorCamRef.current.x;
        cameraRef.current.y = spectatorCamRef.current.y;
      } else {
        inputRef.current.moveX = moveX;
        inputRef.current.moveY = moveY;

        const selfInterp = interpPlayer(
          playerBufRef.current.get(sessionIdRef.current)
        );
        const targetX = selfInterp?.x ?? cameraRef.current.x;
        const targetY = selfInterp?.y ?? cameraRef.current.y;
        const cameraLerp = 1 - Math.exp(-dt * 8);
        cameraRef.current.x += (targetX - cameraRef.current.x) * cameraLerp;
        cameraRef.current.y += (targetY - cameraRef.current.y) * cameraLerp;

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
              (mouseRef.current.x - rect.left - cx) / scale +
              cameraRef.current.x;
            const wy =
              (mouseRef.current.y - rect.top - cy) / scale +
              cameraRef.current.y;
            inputRef.current.aim = Math.atan2(
              wy - selfInterp.y,
              wx - selfInterp.x
            );
            inputRef.current.shooting = mouseShootingRef.current;
          }
        }
      }

      renderFrame(ctx, canvas, rs, sessionIdRef.current, cameraRef.current, {
        playerBuf: playerBufRef.current,
        bulletBuf: bulletBufRef.current,
        shake: shakeRef.current,
        now: Date.now(),
        matchClock: matchClockRef.current,
        activeTowerKind: (rs as ServerState).activeTowerKind ?? "",
        activeBonusKind: (rs as ServerState).activeBonusKind ?? "",
        explosions: explosionsRef.current,
        meteors: meteorFxRef.current,
        bossTrails: bossTrailFxRef.current,
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
          mobileControls ||
          (statusSnapshot.status === "PLAYING" && !statusSnapshot.selfAlive)
            ? "cursor-default"
            : "cursor-crosshair"
        }`}
      />
      <RetroOverlay />
      <MobileControls
        moveStickRef={moveStickRef}
        aimStickRef={aimStickRef}
        enabled={mobileControls && statusSnapshot.status === "PLAYING"}
        aimEnabled={
          mobileControls &&
          statusSnapshot.status === "PLAYING" &&
          statusSnapshot.selfAlive
        }
      />
      <Hud
        snapshot={statusSnapshot}
        killFeed={killFeed}
        pickupToast={pickupToast}
        towerAnnouncement={towerAnnouncement}
        volcanoAnnouncement={volcanoAnnouncement}
        bossAnnouncement={bossAnnouncement}
        lifeToast={lifeToast}
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
  pickupToast: { kind: string; label: string; blurb: string; expiresAt: number } | null;
  towerAnnouncement: {
    vendorName: string;
    bonusKind: string;
    expiresAt: number;
  } | null;
  volcanoAnnouncement: {
    message: string;
    expiresAt: number;
  } | null;
  bossAnnouncement: {
    message: string;
    expiresAt: number;
  } | null;
  lifeToast: {
    title: string;
    message: string;
    expiresAt: number;
  } | null;
  onLeave: () => void;
  compact?: boolean;
}) {
  const { snapshot, killFeed, pickupToast, towerAnnouncement, volcanoAnnouncement, bossAnnouncement, lifeToast, onLeave, compact } =
    props;
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
  const hpPct =
    snapshot.selfMaxHp > 0 ? snapshot.selfHp / snapshot.selfMaxHp : 0;

  return (
    <>
      {towerAnnouncement && (
        <div className="absolute top-16 sm:top-20 inset-x-0 flex justify-center pointer-events-none px-4 z-30">
          <div
            className="border-2 border-fuchsia-400 bg-black/75 px-4 py-2 text-center max-w-lg"
            style={{ fontFamily: MONO_FONT, boxShadow: "0 0 24px rgba(192,38,211,0.35)" }}
          >
            <p className="text-[10px] uppercase tracking-[0.25em] text-fuchsia-300">
              Vendor bonus active
            </p>
            <p className="text-sm sm:text-base font-bold text-white mt-1">
              Visit {towerAnnouncement.vendorName} for{" "}
              {TOWER_BONUS_LABELS[towerAnnouncement.bonusKind] ??
                towerAnnouncement.bonusKind.replace(/_/g, " ")}
              !
            </p>
          </div>
        </div>
      )}

      {volcanoAnnouncement && (
        <div className="absolute top-28 sm:top-32 inset-x-0 flex justify-center pointer-events-none px-4 z-30">
          <div
            className="border-2 border-orange-500 bg-black/80 px-5 py-3 text-center max-w-lg animate-pulse"
            style={{
              fontFamily: MONO_FONT,
              boxShadow: "0 0 32px rgba(249,115,22,0.45)",
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.3em] text-orange-300">
              ⚠ Volcanic event
            </p>
            <p className="text-base sm:text-lg font-bold text-white mt-1">
              {volcanoAnnouncement.message}
            </p>
            <p className="text-[10px] text-orange-200/80 mt-1 tracking-widest uppercase">
              Meteors incoming — stay out of the red zones
            </p>
          </div>
        </div>
      )}

      {bossAnnouncement && (
        <div className="absolute top-28 sm:top-32 inset-x-0 flex justify-center pointer-events-none px-4 z-30">
          <div
            className="border-2 border-lime-400 bg-black/80 px-5 py-3 text-center max-w-lg animate-pulse"
            style={{
              fontFamily: MONO_FONT,
              boxShadow: "0 0 32px rgba(163,230,53,0.4)",
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.3em] text-lime-300">
              ⚠ Slime bosses
            </p>
            <p className="text-base sm:text-lg font-bold text-white mt-1">
              {bossAnnouncement.message}
            </p>
            <p className="text-[10px] text-lime-200/80 mt-1 tracking-widest uppercase">
              Avoid the slime trails — they burn
            </p>
          </div>
        </div>
      )}

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
              hpPct > 0.4
                ? "ok"
                : hpPct > 0.15
                ? "warn"
                : "danger"
            }
          />
          {snapshot.selfWeaponExpiresAtMs > Date.now() && (
            <StatPill
              label="GUN"
              value={Math.ceil(
                Math.max(0, snapshot.selfWeaponExpiresAtMs - Date.now()) / 1000
              ).toString()}
              tone="warn"
            />
          )}
          <StatPill label="K" value={snapshot.selfKills.toString()} tone="ok" />
          {snapshot.selfExtraLives > 0 && (
            <StatPill
              label="LIFE"
              value={snapshot.selfExtraLives.toString()}
              tone="warn"
            />
          )}
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
        <MusicMuteButton compact className="mb-1" />
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

      {lifeToast && (
        <div
          className={`absolute inset-x-0 flex justify-center pointer-events-none ${
            compact ? "bottom-52" : "bottom-28"
          }`}
        >
          <div
            className="border-2 px-4 py-2 bg-black/85 backdrop-blur-sm border-lime-400/80"
            style={{ fontFamily: MONO_FONT }}
          >
            <p className="text-[9px] tracking-[0.35em] uppercase text-lime-300/80">
              ▸ {lifeToast.title}
            </p>
            <p className="text-sm font-bold tracking-[0.12em] uppercase text-lime-200 mt-1">
              {lifeToast.message}
            </p>
          </div>
        </div>
      )}

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
              ▸ Mystery drop
            </p>
            <p
              className="text-base font-bold tracking-[0.15em] uppercase"
              style={{
                color:
                  (WEAPON_COLORS[pickupToast.kind] ?? WEAPON_COLORS.pistol)
                    .core,
              }}
            >
              {pickupToast.label}
            </p>
            <p className="text-[11px] text-neutral-200 mt-1 max-w-xs leading-snug">
              {pickupToast.blurb}
            </p>
          </div>
        </div>
      )}

      {snapshot.status === "ENDED" && (
        <MatchEndOverlay snapshot={snapshot} onLeave={onLeave} />
      )}

      {snapshot.status === "PLAYING" && !snapshot.selfAlive && (
        <div className="absolute inset-x-0 bottom-6 flex justify-center pointer-events-none">
          <p
            className="text-xs uppercase tracking-[0.2em] text-rose-300/95 bg-black/65 px-4 py-2 border border-rose-400/35 text-center max-w-sm"
            style={{ fontFamily: MONO_FONT }}
          >
            Ghost spectating — WASD or left stick to roam
          </p>
        </div>
      )}
    </>
  );
}

function MatchEndOverlay({
  snapshot,
  onLeave,
}: {
  snapshot: ReturnType<typeof snapshotStatus>;
  onLeave: () => void;
}) {
  const won = snapshot.selfPlacement === 1;
  const podium = snapshot.selfPlacement >= 2 && snapshot.selfPlacement <= 3;
  const placement = snapshot.selfPlacement;

  const headline = won
    ? "CHAMPION"
    : podium
    ? "PODIUM FINISH"
    : placement > 0
    ? "ELIMINATED"
    : "MATCH COMPLETE";

  const subline = won
    ? "You survived the island. Crown secured."
    : podium
    ? `#${placement} — still dripped out.`
    : placement > 0
    ? `#${placement} of ${SURVIVOR_MAX_PLAYERS} — run it back.`
    : "Thanks for watching the chaos.";

  const tagline = won
    ? ["Absolute menace.", "Island cleared.", "They never stood a chance."][
        snapshot.selfKills % 3
      ]
    : podium
    ? "So close to the crown."
    : snapshot.selfKills > 0
    ? `${snapshot.selfKills} elim${snapshot.selfKills === 1 ? "" : "s"} — not bad.`
    : "Next drop, different story.";

  return (
    <div className="absolute inset-0 bg-black/88 backdrop-blur-md flex items-center justify-center p-6 pointer-events-auto overflow-hidden">
      {won && <ConfettiBurst />}
      <div className="relative max-w-lg w-full text-center space-y-5">
        <div
          className={`inline-block border-2 px-4 py-1.5 ${
            won
              ? "border-fuchsia-400 shadow-[0_0_30px_rgba(232,121,249,0.45)]"
              : podium
              ? "border-amber-400"
              : "border-rose-400/70"
          }`}
        >
          <p
            className={`text-[10px] uppercase tracking-[0.4em] font-bold ${
              won ? "text-fuchsia-300" : podium ? "text-amber-300" : "text-rose-300"
            }`}
            style={{ fontFamily: MONO_FONT }}
          >
            {won ? "Victory royale" : "Match over"}
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div
            className={`relative ${won ? "animate-pulse" : ""}`}
            style={
              won
                ? {
                    filter: "drop-shadow(0 0 18px rgba(250,204,21,0.55))",
                  }
                : undefined
            }
          >
            <SlimeAvatar
              color={snapshot.selfSlimeColor}
              face={snapshot.selfSlimeFace}
              accessories={snapshot.selfSlimeAccessories}
              size={won ? 128 : 96}
            />
          </div>
          {snapshot.selfDisplayName && (
            <p
              className="text-lg font-bold tracking-[0.25em] uppercase"
              style={{
                color: snapshot.selfNameColor,
                fontFamily: MONO_FONT,
              }}
            >
              {snapshot.selfDisplayName}
            </p>
          )}
        </div>

        <h2
          className={`text-4xl sm:text-5xl font-black tracking-tight uppercase ${
            won
              ? "bg-gradient-to-r from-fuchsia-300 via-yellow-300 to-cyan-300 bg-clip-text text-transparent"
              : podium
              ? "text-amber-300"
              : "text-white"
          }`}
        >
          {headline}
        </h2>

        <p className="text-base text-neutral-200">{subline}</p>
        <p
          className="text-sm text-fuchsia-300/90 italic"
          style={{ fontFamily: MONO_FONT }}
        >
          {tagline}
        </p>

        <div className="flex justify-center gap-6 pt-1">
          {placement > 0 && (
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-[0.3em] text-neutral-500">
                Place
              </p>
              <p className="text-2xl font-bold text-white">#{placement}</p>
            </div>
          )}
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-[0.3em] text-neutral-500">
              Kills
            </p>
            <p className="text-2xl font-bold text-emerald-400">
              {snapshot.selfKills}
            </p>
          </div>
        </div>

        {won && (
          <p className="text-xs text-neutral-400 pt-1">
            Prize details coming to your inbox. Go flex.
          </p>
        )}

        <button
          type="button"
          onClick={onLeave}
          className={`text-xs tracking-widest uppercase px-6 py-3 border transition-colors ${
            won
              ? "border-fuchsia-400 text-fuchsia-200 hover:bg-fuchsia-500 hover:text-black"
              : "border-white text-white hover:bg-white hover:text-black"
          }`}
        >
          Back to lobby
        </button>
      </div>
    </div>
  );
}

function ConfettiBurst() {
  const colors = ["#f472b6", "#facc15", "#22d3ee", "#a3e635", "#e879f9"];
  const pieces = Array.from({ length: 48 }, (_, i) => ({
    id: i,
    left: `${(i * 17 + 7) % 100}%`,
    delay: `${(i % 8) * 0.25}s`,
    duration: `${2.5 + (i % 5) * 0.4}s`,
    color: colors[i % colors.length],
    size: 6 + (i % 4),
    rotate: (i * 47) % 360,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      <style>{`
        @keyframes obh-confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.35; }
        }
        .obh-confetti-piece {
          animation: obh-confetti-fall linear forwards;
        }
      `}</style>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="obh-confetti-piece absolute top-0"
          style={{
            left: p.left,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            transform: `rotate(${p.rotate}deg)`,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
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

function forEachPlayer(
  rs: ServerState,
  cb: (p: ServerPlayer, sessionId: string) => void
): void {
  const players = rs.players as unknown as {
    forEach?: (fn: (p: ServerPlayer, k: string) => void) => void;
  };
  if (typeof players?.forEach !== "function") return;
  players.forEach(cb);
}

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
    selfMaxHp: 100,
    selfTowerBuffKind: "",
    selfDisplayName: "",
    selfSlimeColor: DEFAULT_SLIME_COLOR,
    selfSlimeFace: 0,
    selfSlimeAccessories: 0,
    selfNameColor: DEFAULT_NAME_COLOR,
    selfExtraLives: 0,
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
      selfMaxHp:
        self && typeof self.maxHp === "number" && self.maxHp > 0
          ? self.maxHp
          : 100,
      selfTowerBuffKind: self?.towerBuffKind ?? "",
      selfDisplayName: self?.displayName ?? "",
      selfSlimeColor: self?.slimeColor || DEFAULT_SLIME_COLOR,
      selfSlimeFace:
        typeof self?.slimeFace === "number"
          ? Math.max(0, Math.min(3, self.slimeFace))
          : 0,
      selfSlimeAccessories:
        typeof self?.slimeAccessories === "number" ? self.slimeAccessories : 0,
      selfNameColor: parseNameColor(self?.nameColor),
      selfExtraLives:
        typeof self?.extraLives === "number" && self.extraLives > 0
          ? self.extraLives
          : 0,
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

/** Skip draw calls for entities far outside the camera (50-player perf). */
const VIEW_CULL_MARGIN = 140;

function worldInView(
  camX: number,
  camY: number,
  cssW: number,
  cssH: number,
  scale: number,
  x: number,
  y: number,
  radius = 0
): boolean {
  const halfW = cssW / scale / 2 + VIEW_CULL_MARGIN + radius;
  const halfH = cssH / scale / 2 + VIEW_CULL_MARGIN + radius;
  return Math.abs(x - camX) <= halfW && Math.abs(y - camY) <= halfH;
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
  activeTowerKind: string;
  activeBonusKind: string;
  explosions: Array<{
    x: number;
    y: number;
    radius: number;
    kind: string;
    expiresAt: number;
  }>;
  meteors: Array<{
    x: number;
    y: number;
    radius: number;
    startMs: number;
    impactAtMs: number;
    craterUntilMs: number;
  }>;
  bossTrails: Array<{
    x: number;
    y: number;
    radius: number;
    expiresAtMs: number;
    color: string;
  }>;
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
  ocean.addColorStop(0, "#7dd3fc");
  ocean.addColorStop(0.55, "#38bdf8");
  ocean.addColorStop(1, "#0284c7");
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
    const pad = Math.max(o.w, o.h) * 0.6;
    if (!worldInView(camX, camY, cssW, cssH, scale, o.x, o.y, pad)) return;
    drawObstacle(
      ctx,
      o,
      w2s,
      scale,
      now,
      rctx.activeTowerKind,
      rctx.activeBonusKind
    );
  });

  drawCreepingWater(ctx, zoneVisual, w2s, scale, cssW, cssH, now);
  drawZoneRings(ctx, zoneVisual, w2s, scale, now);

  if (rs.pickups && typeof (rs.pickups as { forEach?: unknown }).forEach === "function") {
    (rs.pickups as unknown as {
      forEach: (cb: (p: ServerPickup) => void) => void;
    }).forEach((pu) => {
      if (!worldInView(camX, camY, cssW, cssH, scale, pu.x, pu.y, 40)) return;
      drawPickup(ctx, pu, w2s, scale, now);
    });
  }

  drawBullets(ctx, w2s, scale, now, rctx.bulletBuf, camX, camY, cssW, cssH);
  drawMeteorFx(ctx, w2s, scale, now, rctx.meteors);
  drawBossTrails(ctx, w2s, scale, now, rctx.bossTrails);
  drawExplosions(ctx, w2s, scale, now, rctx.explosions);

  if (rs.bosses) {
    iterateSchemaArray<ServerBoss>(rs.bosses, (boss) => {
      drawBoss(ctx, boss, w2s, scale, now);
    });
  }

  forEachPlayer(rs, (p, sessionId) => {
    const isSelf = sessionId === selfId;
    const px = p.x ?? 0;
    const py = p.y ?? 0;
    if (
      !isSelf &&
      !worldInView(camX, camY, cssW, cssH, scale, px, py, 48)
    ) {
      return;
    }
    const buf = rctx.playerBuf.get(sessionId);
    const lerp =
      interpPlayer(buf) ?? {
        x: px,
        y: py,
        aim: p.aim ?? 0,
      };
    drawPlayer(ctx, p, isSelf, lerp, w2s, scale, now);
  });

  ctx.restore();
}

function drawExplosions(
  ctx: CanvasRenderingContext2D,
  w2s: (x: number, y: number) => { sx: number; sy: number },
  scale: number,
  now: number,
  explosions: RenderCtx["explosions"]
) {
  for (const ex of explosions) {
    const age = 1 - (ex.expiresAt - now) / 450;
    if (age < 0 || age > 1) continue;
    const screen = w2s(ex.x, ex.y);
    const r = ex.radius * scale * (0.4 + age * 0.9);
    ctx.save();
    ctx.globalAlpha = 1 - age * 0.85;
    const grad = ctx.createRadialGradient(screen.sx, screen.sy, 0, screen.sx, screen.sy, r);
    grad.addColorStop(0, "rgba(254,240,138,0.95)");
    grad.addColorStop(0.35, "rgba(251,146,60,0.75)");
    grad.addColorStop(0.7, "rgba(239,68,68,0.35)");
    grad.addColorStop(1, "rgba(239,68,68,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(screen.sx, screen.sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = Math.max(2, 3 * scale);
    ctx.beginPath();
    ctx.arc(screen.sx, screen.sy, r * 0.65, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawOcean(ctx: CanvasRenderingContext2D, cssW: number, cssH: number) {
  const ocean = ctx.createLinearGradient(0, 0, 0, cssH);
  ocean.addColorStop(0, "#7dd3fc");
  ocean.addColorStop(0.45, "#38bdf8");
  ocean.addColorStop(0.75, "#0ea5e9");
  ocean.addColorStop(1, "#0369a1");
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
  sand.addColorStop(0, "#fff4d6");
  sand.addColorStop(0.4, "#f5dc9a");
  sand.addColorStop(0.72, "#e8c068");
  sand.addColorStop(1, "#d4a44a");
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
  water.addColorStop(0, "rgba(56,189,248,0.45)");
  water.addColorStop(1, "rgba(2,132,199,0.62)");
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
  ctx.strokeStyle = "rgba(192,38,211,0.7)";
  ctx.lineWidth = 1.5;
  ctx.shadowColor = "rgba(124,58,237,0.45)";
  ctx.shadowBlur = 6;
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
  buf: BulletBuffer,
  camX: number,
  camY: number,
  cssW: number,
  cssH: number
) {
  if (!buf || buf.size === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  buf.forEach((b) => {
    const dt = (now - b.t) / 1000;
    const x = b.x + b.vx * dt;
    const y = b.y + b.vy * dt;
    if (!worldInView(camX, camY, cssW, cssH, scale, x, y, 24)) return;
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

function isTowerObstacle(kind: string): boolean {
  return kind.startsWith("tower_");
}

function drawTowerGlowRing(
  ctx: CanvasRenderingContext2D,
  o: ServerObstacle,
  w2s: (x: number, y: number) => { sx: number; sy: number },
  scale: number,
  bonusKind: string,
  now: number
) {
  const centre = w2s(o.x, o.y + o.h * 0.15);
  const ringR = TOWER_BUFF_RADIUS * scale;
  const pulse = 0.88 + Math.sin(now * 0.004) * 0.12;
  const color =
    TOWER_BONUS_RING_COLORS[bonusKind] ?? "rgba(251,191,36,0.8)";

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, 4 * scale);
  ctx.shadowColor = color;
  ctx.shadowBlur = 18 * pulse;
  ctx.globalAlpha = 0.5 + Math.sin(now * 0.005) * 0.15;
  ctx.beginPath();
  ctx.arc(centre.sx, centre.sy, ringR * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawObstacle(
  ctx: CanvasRenderingContext2D,
  o: ServerObstacle,
  w2s: (x: number, y: number) => { sx: number; sy: number },
  scale: number,
  now: number,
  activeTowerKind: string,
  activeBonusKind: string
) {
  const kind = o.kind;
  const isActiveTower = isTowerObstacle(kind) && kind === activeTowerKind;

  if (isActiveTower) {
    drawTowerGlowRing(ctx, o, w2s, scale, activeBonusKind, now);
  }

  if (kind === "gorilla" || kind === "flower" || isTowerObstacle(kind)) {
    drawSpriteObstacle(ctx, o, w2s, scale, kind);
  } else if (kind === "volcano") {
    drawVolcano(ctx, o, w2s, scale, now);
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
  if (img && img.width > 0 && img.height > 0) {
    ctx.drawImage(img, tl.sx, tl.sy, w, h);
  } else {
    ctx.fillStyle = kind.includes("tower")
      ? "#6366f1"
      : kind === "flower"
      ? "#f472b6"
      : "#78716c";
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

function drawVolcano(
  ctx: CanvasRenderingContext2D,
  o: ServerObstacle,
  w2s: (x: number, y: number) => { sx: number; sy: number },
  scale: number,
  now: number
) {
  const cx = o.x;
  const baseY = o.y + o.h * 0.42;
  const craterY = o.y - o.h * 0.22;
  const pulse = 0.65 + 0.35 * Math.sin(now / 380);
  const poolPulse = 0.5 + 0.5 * Math.sin(now / 260);
  const pool = w2s(cx, baseY + 28);
  const poolRx = VOLCANO_LAVA_RADIUS * scale * 0.92;
  const poolRy = VOLCANO_LAVA_RADIUS * scale * 0.55;

  ctx.save();

  ctx.fillStyle = `rgba(255,80,25,${0.1 * poolPulse})`;
  ctx.beginPath();
  ctx.ellipse(pool.sx, pool.sy, poolRx, poolRy, 0, 0, Math.PI * 2);
  ctx.fill();

  const peak = w2s(cx, craterY);
  const left = w2s(cx - o.w * 0.52, baseY);
  const right = w2s(cx + o.w * 0.52, baseY);
  const base = w2s(cx, baseY);

  ctx.fillStyle = "#3a2518";
  ctx.beginPath();
  ctx.moveTo(peak.sx, peak.sy);
  ctx.lineTo(left.sx, base.sy);
  ctx.lineTo(right.sx, base.sy);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#261610";
  ctx.beginPath();
  ctx.moveTo(peak.sx, peak.sy);
  ctx.lineTo(base.sx, base.sy);
  ctx.lineTo(right.sx, base.sy);
  ctx.closePath();
  ctx.fill();

  const crater = w2s(cx, craterY + o.h * 0.06);
  ctx.fillStyle = "#120a08";
  ctx.beginPath();
  ctx.ellipse(
    crater.sx,
    crater.sy,
    o.w * scale * 0.24,
    o.h * scale * 0.1,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.fillStyle = `rgba(255,110,35,${0.75 * pulse})`;
  ctx.beginPath();
  ctx.ellipse(
    crater.sx,
    crater.sy + 2,
    o.w * scale * 0.17,
    o.h * scale * 0.06,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  for (let i = 0; i < 5; i++) {
    const sx = crater.sx + Math.sin(now / 500 + i * 1.4) * o.w * scale * 0.08;
    const drift = ((now / 40 + i * 30) % 40) / 40;
    const sy = crater.sy - 8 - drift * 36;
    ctx.fillStyle = `rgba(200,200,210,${0.25 * (1 - drift)})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 5 + i, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = `rgba(255,70,15,${0.28 * poolPulse})`;
  ctx.beginPath();
  ctx.ellipse(pool.sx, pool.sy, poolRx, poolRy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255,140,40,${0.22 * poolPulse})`;
  ctx.beginPath();
  ctx.ellipse(
    pool.sx,
    pool.sy - 4 * scale,
    poolRx * 0.6,
    poolRy * 0.58,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2 + now / 300;
    const fx = pool.sx + Math.cos(ang) * poolRx * 0.55;
    const fy = pool.sy + Math.sin(ang) * poolRy * 0.35;
    ctx.fillStyle = `rgba(255,${90 + (i % 4) * 25},30,${0.35 * poolPulse})`;
    ctx.beginPath();
    ctx.arc(fx, fy, (7 + Math.sin(now / 90 + i) * 3) * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawMeteorFx(
  ctx: CanvasRenderingContext2D,
  w2s: (x: number, y: number) => { sx: number; sy: number },
  scale: number,
  now: number,
  meteors: RenderCtx["meteors"]
) {
  for (const m of meteors) {
    const target = w2s(m.x, m.y);
    const r = m.radius * scale;

    if (now < m.impactAtMs) {
      const total = Math.max(1, m.impactAtMs - m.startMs);
      const progress = Math.min(1, (now - m.startMs) / total);
      const pulse = 0.55 + 0.45 * Math.sin(now / 110);

      ctx.save();
      ctx.strokeStyle = `rgba(255,90,30,${0.35 + pulse * 0.4})`;
      ctx.lineWidth = Math.max(2, 4 * scale);
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.arc(target.sx, target.sy, r * (0.7 + progress * 0.3), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = `rgba(255,210,80,${0.55 * pulse})`;
      ctx.lineWidth = Math.max(1, 2 * scale);
      ctx.beginPath();
      ctx.arc(target.sx, target.sy, r * 0.35, 0, Math.PI * 2);
      ctx.stroke();

      const streakTop = w2s(m.x, m.y - 420 + progress * 400);
      const grad = ctx.createLinearGradient(
        streakTop.sx,
        streakTop.sy - 70 * scale,
        target.sx,
        target.sy
      );
      grad.addColorStop(0, "rgba(255,180,80,0)");
      grad.addColorStop(0.45, "rgba(255,110,40,0.85)");
      grad.addColorStop(1, "rgba(255,45,15,1)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = Math.max(8, 18 * scale);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(streakTop.sx, streakTop.sy - 50 * scale);
      ctx.lineTo(target.sx, target.sy - 8 * scale);
      ctx.stroke();

      ctx.fillStyle = "#ff5c2a";
      ctx.beginPath();
      ctx.arc(streakTop.sx, streakTop.sy, Math.max(10, 18 * scale), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,220,150,0.7)";
      ctx.beginPath();
      ctx.arc(
        streakTop.sx - 5 * scale,
        streakTop.sy - 5 * scale,
        Math.max(4, 6 * scale),
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    } else if (now < m.craterUntilMs) {
      const linger = m.craterUntilMs - m.impactAtMs;
      const fade = 1 - (now - m.impactAtMs) / linger;
      ctx.save();
      ctx.fillStyle = `rgba(15,8,6,${0.75 * fade})`;
      ctx.beginPath();
      ctx.arc(target.sx, target.sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,75,20,${0.4 * fade})`;
      ctx.beginPath();
      ctx.arc(target.sx, target.sy, r * 0.78, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * Math.PI * 2 + now / 180;
        const fx = target.sx + Math.cos(ang) * r * 0.52;
        const fy = target.sy + Math.sin(ang) * r * 0.38;
        ctx.fillStyle = `rgba(255,${120 + (i % 3) * 35},35,${0.55 * fade})`;
        ctx.beginPath();
        ctx.arc(
          fx,
          fy,
          (9 + Math.sin(now / 70 + i) * 4) * scale,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

function drawMysteryPickup(
  ctx: CanvasRenderingContext2D,
  pos: { sx: number; sy: number },
  scale: number,
  now: number
) {
  const bob = Math.sin(now / 260) * 4 * scale;
  const cy = pos.sy + bob;
  const pulse = 0.88 + 0.12 * Math.sin(now / 200);
  const cx = pos.sx;

  ctx.save();
  ctx.fillStyle = "rgba(255,80,160,0.18)";
  ctx.beginPath();
  ctx.arc(cx, cy, 34 * scale * pulse, 0, Math.PI * 2);
  ctx.fill();

  const arcColors = ["#ff6eb4", "#a855f7", "#22d3ee"];
  const arcRadii = [28, 22, 16];
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = arcColors[i]!;
    ctx.lineWidth = Math.max(2, 4 * scale);
    ctx.shadowColor = arcColors[i]!;
    ctx.shadowBlur = 12 * scale;
    ctx.beginPath();
    ctx.arc(
      cx,
      cy + 6 * scale,
      arcRadii[i]! * scale * pulse,
      Math.PI * 1.08,
      Math.PI * 1.92
    );
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#ff4d6d";
  ctx.shadowColor = "#ff4d6d";
  ctx.shadowBlur = 14 * scale;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 10 * scale);
  ctx.bezierCurveTo(
    cx - 12 * scale,
    cy - 2 * scale,
    cx - 10 * scale,
    cy - 14 * scale,
    cx,
    cy - 8 * scale
  );
  ctx.bezierCurveTo(
    cx + 10 * scale,
    cy - 14 * scale,
    cx + 12 * scale,
    cy - 2 * scale,
    cx,
    cy + 10 * scale
  );
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `bold ${Math.max(8, 9 * scale)}px ${MONO_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("?", cx, cy - 2 * scale);
  ctx.restore();
}

function drawBossTrails(
  ctx: CanvasRenderingContext2D,
  w2s: (x: number, y: number) => { sx: number; sy: number },
  scale: number,
  now: number,
  trails: RenderCtx["bossTrails"]
) {
  for (const trail of trails) {
    const fade = Math.max(
      0,
      Math.min(1, (trail.expiresAtMs - now) / BOSS_TRAIL_LINGER_MS)
    );
    if (fade <= 0) continue;
    const pos = w2s(trail.x, trail.y);
    const r = trail.radius * scale;
    const pulse = 0.65 + 0.35 * Math.sin(now / 180 + trail.x * 0.01);

    ctx.save();
    ctx.globalAlpha = 0.35 * fade * pulse;
    ctx.fillStyle = trail.color;
    ctx.shadowColor = trail.color;
    ctx.shadowBlur = 16 * scale;
    ctx.beginPath();
    ctx.ellipse(pos.sx, pos.sy, r, r * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.55 * fade;
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.ellipse(pos.sx, pos.sy - 2 * scale, r * 0.55, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawBoss(
  ctx: CanvasRenderingContext2D,
  boss: ServerBoss,
  w2s: (x: number, y: number) => { sx: number; sy: number },
  scale: number,
  now: number
) {
  const screen = w2s(boss.x, boss.y);
  const bob = 1 + 0.05 * Math.sin(now / 420 + boss.x * 0.003);
  const r = Math.max(24, boss.radius * scale) * bob;
  const slimeColor = boss.slimeColor || "#a3e635";
  const slimeFace =
    typeof boss.slimeFace === "number" ? parseSlimeFace(boss.slimeFace) : 0;
  const maxHp = boss.maxHp > 0 ? boss.maxHp : 900;
  const aim =
    typeof boss.aim === "number" && Number.isFinite(boss.aim)
      ? boss.aim
      : Math.sin(now / 900 + boss.x * 0.002) * 0.4;

  ctx.save();
  ctx.shadowColor = slimeColor;
  ctx.shadowBlur = 28 * scale;
  drawSlime(
    ctx,
    screen.sx,
    screen.sy,
    r,
    slimeColor,
    slimeFace,
    aim,
    false,
    true,
    now,
    0,
    0
  );
  ctx.shadowBlur = 0;

  const barW = Math.max(56, r * 2.4);
  const barH = Math.max(5, 6 * scale);
  const bx = screen.sx - barW / 2;
  const by = screen.sy - r - 22;
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(bx, by, barW, barH);
  const pct = Math.max(0, Math.min(1, boss.hp / maxHp));
  ctx.fillStyle = pct > 0.35 ? slimeColor : "#f87171";
  ctx.fillRect(bx, by, barW * pct, barH);
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, barW, barH);

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.max(9, 10 * scale)}px ${MONO_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("GIANT SLIME", screen.sx, by - 4);
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

  if (pu.kind === "mystery") {
    drawMysteryPickup(ctx, pos, scale, now);
    return;
  }

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
      : pu.kind === "ice_bow"
      ? "I"
      : pu.kind === "flamethrower"
      ? "T"
      : pu.kind === "rocket"
      ? "R"
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
  const radiusScale =
    typeof p.radiusScale === "number" && p.radiusScale > 0 ? p.radiusScale : 1;
  const r = PLAYER_R * scale * radiusScale;
  const maxHp = p.maxHp > 0 ? p.maxHp : 100;
  const weapon = (p.weapon || "pistol").toLowerCase();
  const frozen = (p.frozenUntilMs ?? 0) > now;
  const burning = (p.burnUntilMs ?? 0) > now;
  const slimeColor = p.slimeColor || DEFAULT_SLIME_COLOR;
  const slimeFace =
    typeof p.slimeFace === "number"
      ? parseSlimeFace(p.slimeFace)
      : 0;
  const slimeHeadAccessory = parseSlimeHeadAccessory(
    p.slimeHeadAccessory,
    typeof p.slimeAccessories === "number" ? p.slimeAccessories : 0
  );
  const slimeBodyAccessory = parseSlimeBodyAccessory(
    p.slimeBodyAccessory,
    typeof p.slimeAccessories === "number" ? p.slimeAccessories : 0
  );
  const nameColor = parseNameColor(p.nameColor);
  const nameOutline = parseNameOutline(p.nameOutline);
  const nameBadge = parseNameBadge(p.nameBadge);

  ctx.save();
  if (!p.alive) ctx.globalAlpha = 0.28;

  drawSlime(
    ctx,
    screen.sx,
    screen.sy,
    r,
    slimeColor,
    slimeFace,
    pos.aim,
    frozen,
    burning,
    now,
    slimeHeadAccessory,
    slimeBodyAccessory
  );

  if (p.alive) {
    const wcolor = WEAPON_COLORS[weapon] ?? WEAPON_COLORS.pistol;
    const barrelLen =
      weapon === "rocket"
        ? r + 24
        : weapon === "flamethrower"
        ? r + 18
        : weapon === "ice_bow"
        ? r + 22
        : r + 14;
    ctx.save();
    ctx.strokeStyle = wcolor.core;
    ctx.shadowColor = wcolor.glow;
    ctx.shadowBlur = weapon === "flamethrower" ? 12 : 8;
    ctx.lineWidth = Math.max(2.5, 5 * scale);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(screen.sx, screen.sy);
    ctx.lineTo(
      screen.sx + Math.cos(pos.aim) * barrelLen,
      screen.sy + Math.sin(pos.aim) * barrelLen
    );
    ctx.stroke();
    if (weapon === "ice_bow") {
      ctx.beginPath();
      ctx.moveTo(
        screen.sx + Math.cos(pos.aim) * (r + 10),
        screen.sy + Math.sin(pos.aim) * (r + 10)
      );
      ctx.lineTo(
        screen.sx + Math.cos(pos.aim + 0.35) * (r + 18),
        screen.sy + Math.sin(pos.aim + 0.35) * (r + 18)
      );
      ctx.stroke();
    }
    if (weapon === "rocket") {
      ctx.fillStyle = wcolor.core;
      ctx.beginPath();
      ctx.arc(
        screen.sx + Math.cos(pos.aim) * (barrelLen - 4),
        screen.sy + Math.sin(pos.aim) * (barrelLen - 4),
        Math.max(3, 4 * scale),
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.restore();
  }

  if (isSelf && p.alive) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(screen.sx, screen.sy, r * 1.35, 0, Math.PI * 2);
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
    const pct = Math.max(0, Math.min(1, p.hp / maxHp));
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

  // Display name — colour, outline, optional badge.
  const nameSize = Math.max(13, 15 * Math.min(1.6, scale));
  const nameY = screen.sy - r - 22;
  const label = p.displayName.toUpperCase();
  const badge =
    NAME_BADGES.find((b) => b.id === nameBadge)?.glyph ?? "";
  ctx.globalAlpha = p.alive ? 0.95 : 0.4;
  ctx.font = `bold ${nameSize}px ${MONO_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";

  const nameW = ctx.measureText(label).width;
  const badgeGap = badge ? nameSize * 0.45 : 0;
  const totalW = nameW + badgeGap;
  const textX = badge ? screen.sx + badgeGap * 0.35 : screen.sx;

  if (badge) {
    ctx.font = `${nameSize * 0.95}px ${MONO_FONT}`;
    ctx.fillStyle = nameColor;
    ctx.fillText(badge, screen.sx - totalW / 2 + nameSize * 0.35, nameY);
    ctx.font = `bold ${nameSize}px ${MONO_FONT}`;
  }

  if (nameOutline === NAME_OUTLINE_GLOW) {
    ctx.shadowColor = "rgba(255,255,255,0.95)";
    ctx.shadowBlur = Math.max(4, nameSize * 0.35);
  } else {
    ctx.shadowBlur = 0;
  }

  if (nameOutline === NAME_OUTLINE_HEAVY || nameOutline === 0) {
    ctx.strokeStyle =
      nameOutline === NAME_OUTLINE_HEAVY
        ? "rgba(0,0,0,0.95)"
        : "rgba(0,0,0,0.75)";
    ctx.lineWidth = Math.max(2, nameSize * (nameOutline === NAME_OUTLINE_HEAVY ? 0.18 : 0.14));
    ctx.lineJoin = "round";
    ctx.strokeText(label, textX, nameY);
  }

  ctx.shadowBlur = 0;
  ctx.fillStyle = nameColor;
  ctx.fillText(label, textX, nameY);

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

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
