import { Obstacle, Player } from "./state";
import type { EscapeLunaState } from "./luna-state";
import {
  WORLD_HALF,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  OBSTACLE_KEEP_OUT,
  OBSTACLE_MIN_SPACING,
  OBSTACLE_EDGE_INSET,
  OBSTACLE_PLACEMENT_ATTEMPTS,
  WALL_SEGMENT_LEN,
  WALL_SEGMENT_THICKNESS,
  WALL_SEG_MIN,
  WALL_SEG_MAX,
  WALL_BEND_PROB,
} from "./constants";
import {
  LUNA_CLIFF_CLUSTER_COUNT,
  LUNA_EXTRA_WALL_SEGMENTS,
  LUNA_MAZE_SPOKE_COUNT,
  LUNA_PREDICT_SEC,
  LUNA_RADIUS,
  LUNA_RING_WALL_COUNT,
  LUNA_SPEED_MAX,
  LUNA_SPEED_START,
  LUNA_STEER_RATE,
  LUNA_ZONE_DPS_END,
  LUNA_ZONE_DPS_START,
  LUNA_ZONE_END_RADIUS,
  LUNA_ZONE_START_RADIUS,
} from "./luna-constants";
import { emptyInput, sanitizeInput, type PlayerInput } from "./physics";

export { emptyInput, sanitizeInput, type PlayerInput };

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

interface ObstacleRect {
  kind: "cliff" | "rock";
  x: number;
  y: number;
  w: number;
  h: number;
}

function rectOverlap(a: ObstacleRect, b: ObstacleRect, margin: number) {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 + margin &&
    Math.abs(a.y - b.y) < (a.h + b.h) / 2 + margin
  );
}

function withinWorld(r: ObstacleRect) {
  return (
    Math.abs(r.x) + r.w / 2 < WORLD_HALF - OBSTACLE_EDGE_INSET &&
    Math.abs(r.y) + r.h / 2 < WORLD_HALF - OBSTACLE_EDGE_INSET
  );
}

function withinPlayableZone(state: EscapeLunaState, r: ObstacleRect, margin = 0) {
  const halfDiag = Math.hypot(r.w, r.h) / 2 + margin;
  const limit = Math.max(120, state.zone.radius - OBSTACLE_EDGE_INSET);
  return Math.hypot(r.x - state.zone.cx, r.y - state.zone.cy) + halfDiag <= limit;
}

function tryPlaceObstacle(
  state: EscapeLunaState,
  placed: ObstacleRect[],
  candidate: ObstacleRect
) {
  if (!withinWorld(candidate) || !withinPlayableZone(state, candidate, 10)) {
    return false;
  }
  for (const p of placed) {
    if (rectOverlap(candidate, p, OBSTACLE_MIN_SPACING)) return false;
  }
  placed.push(candidate);
  return true;
}

function generateWallCluster(
  state: EscapeLunaState,
  placed: ObstacleRect[]
): ObstacleRect[] | null {
  const xMax = WORLD_HALF - OBSTACLE_EDGE_INSET - WALL_SEGMENT_LEN;
  const yMax = WORLD_HALF - OBSTACLE_EDGE_INSET - WALL_SEGMENT_LEN;

  for (let attempt = 0; attempt < OBSTACLE_PLACEMENT_ATTEMPTS; attempt++) {
    let cx = (Math.random() * 2 - 1) * xMax;
    let cy = (Math.random() * 2 - 1) * yMax;
    if (Math.hypot(cx, cy) < OBSTACLE_KEEP_OUT) continue;

    let horizontal = Math.random() < 0.5;
    const segCount =
      WALL_SEG_MIN + Math.floor(Math.random() * (WALL_SEG_MAX - WALL_SEG_MIN + 1));
    const bendAt =
      segCount >= 3 && Math.random() < WALL_BEND_PROB
        ? 1 + Math.floor(Math.random() * (segCount - 1))
        : -1;

    const segments: ObstacleRect[] = [];
    let ok = true;
    for (let s = 0; s < segCount; s++) {
      if (s === bendAt) {
        if (horizontal) cy += (Math.random() < 0.5 ? 1 : -1) * (WALL_SEGMENT_LEN / 2);
        else cx += (Math.random() < 0.5 ? 1 : -1) * (WALL_SEGMENT_LEN / 2);
        horizontal = !horizontal;
      }
      const w = horizontal ? WALL_SEGMENT_LEN : WALL_SEGMENT_THICKNESS;
      const h = horizontal ? WALL_SEGMENT_THICKNESS : WALL_SEGMENT_LEN;
      const seg: ObstacleRect = { kind: "cliff", x: cx, y: cy, w, h };
      if (!withinWorld(seg) || !withinPlayableZone(state, seg, 8)) {
        ok = false;
        break;
      }
      for (const p of placed) {
        if (rectOverlap(seg, p, OBSTACLE_MIN_SPACING)) {
          ok = false;
          break;
        }
      }
      if (!ok) break;
      segments.push(seg);
      if (horizontal) cx += WALL_SEGMENT_LEN;
      else cy += WALL_SEGMENT_LEN;
    }
    if (ok && segments.length >= WALL_SEG_MIN) return segments;
  }
  return null;
}

function generateMazeSpokes(state: EscapeLunaState, placed: ObstacleRect[]) {
  const zr = state.zone.radius - OBSTACLE_EDGE_INSET * 2;
  for (let i = 0; i < LUNA_MAZE_SPOKE_COUNT; i++) {
    const baseAngle = (i / LUNA_MAZE_SPOKE_COUNT) * Math.PI * 2 + Math.random() * 0.12;
    const segCount = 3 + Math.floor(Math.random() * 4);
    for (let s = 0; s < segCount; s++) {
      const dist = OBSTACLE_KEEP_OUT + 80 + s * (WALL_SEGMENT_LEN * 0.88);
      if (dist > zr * 0.88) break;
      const x = Math.cos(baseAngle) * dist;
      const y = Math.sin(baseAngle) * dist;
      const along = baseAngle + Math.PI / 2;
      const w = WALL_SEGMENT_LEN;
      const h = WALL_SEGMENT_THICKNESS;
      const cx = x + Math.cos(along) * (s % 2 === 0 ? 0 : WALL_SEGMENT_LEN * 0.4);
      const cy = y + Math.sin(along) * (s % 2 === 0 ? 0 : WALL_SEGMENT_LEN * 0.4);
      tryPlaceObstacle(state, placed, { kind: "cliff", x: cx, y: cy, w, h });
    }
  }
}

function generateRingWalls(state: EscapeLunaState, placed: ObstacleRect[]) {
  for (let ring = 0; ring < LUNA_RING_WALL_COUNT; ring++) {
    const radius =
      OBSTACLE_KEEP_OUT +
      220 +
      ring * ((state.zone.radius * 0.72) / LUNA_RING_WALL_COUNT);
    const gaps = 3 + Math.floor(Math.random() * 3);
    const gapWidth = ((Math.PI * 2) / gaps) * 0.35;
    for (let g = 0; g < gaps; g++) {
      const gapCenter = (g / gaps) * Math.PI * 2 + Math.random() * 0.2;
      const arcLen = (Math.PI * 2) / gaps - gapWidth;
      const segments = Math.max(2, Math.floor(arcLen / 0.45));
      for (let s = 0; s < segments; s++) {
        const t = s / Math.max(1, segments - 1);
        const angle = gapCenter + gapWidth / 2 + t * arcLen;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const tangent = angle + Math.PI / 2;
        tryPlaceObstacle(state, placed, {
          kind: "cliff",
          x: x + Math.cos(tangent) * (WALL_SEGMENT_LEN * 0.1),
          y: y + Math.sin(tangent) * (WALL_SEGMENT_LEN * 0.1),
          w: WALL_SEGMENT_LEN * 0.85,
          h: WALL_SEGMENT_THICKNESS,
        });
      }
    }
  }
}

function generateExtraSegments(state: EscapeLunaState, placed: ObstacleRect[]) {
  let count = 0;
  let attempts = LUNA_EXTRA_WALL_SEGMENTS * OBSTACLE_PLACEMENT_ATTEMPTS;
  while (count < LUNA_EXTRA_WALL_SEGMENTS && attempts > 0) {
    attempts--;
    const horizontal = Math.random() < 0.5;
    const w = horizontal ? WALL_SEGMENT_LEN : WALL_SEGMENT_THICKNESS;
    const h = horizontal ? WALL_SEGMENT_THICKNESS : WALL_SEGMENT_LEN;
    const angle = Math.random() * Math.PI * 2;
    const dist =
      OBSTACLE_KEEP_OUT +
      Math.random() * (state.zone.radius * 0.7 - OBSTACLE_KEEP_OUT);
    const candidate: ObstacleRect = {
      kind: Math.random() < 0.85 ? "cliff" : "rock",
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      w,
      h,
    };
    if (tryPlaceObstacle(state, placed, candidate)) count++;
  }
}

export function generateLunaMaze(state: EscapeLunaState): void {
  state.obstacles.clear();
  const placed: ObstacleRect[] = [];

  for (let i = 0; i < LUNA_CLIFF_CLUSTER_COUNT; i++) {
    const cluster = generateWallCluster(state, placed);
    if (!cluster) continue;
    for (const seg of cluster) placed.push(seg);
  }

  generateMazeSpokes(state, placed);
  generateRingWalls(state, placed);
  generateExtraSegments(state, placed);

  for (const p of placed) {
    const o = new Obstacle();
    o.kind = p.kind;
    o.x = p.x;
    o.y = p.y;
    o.w = p.w;
    o.h = p.h;
    state.obstacles.push(o);
  }

  console.log(`[escape-luna] generateLunaMaze placed ${state.obstacles.length} segments`);
}

function resolveAgainstObstacles(
  x: number,
  y: number,
  obstacles: EscapeLunaState["obstacles"],
  axis: "x" | "y",
  radius: number
) {
  let px = x;
  let py = y;
  obstacles.forEach((o) => {
    const left = o.x - o.w / 2 - radius;
    const right = o.x + o.w / 2 + radius;
    const top = o.y - o.h / 2 - radius;
    const bottom = o.y + o.h / 2 + radius;
    if (px <= left || px >= right || py <= top || py >= bottom) return;
    if (axis === "x") {
      const toLeft = px - left;
      const toRight = right - px;
      px = toLeft < toRight ? left : right;
    } else {
      const toTop = py - top;
      const toBottom = bottom - py;
      py = toTop < toBottom ? top : bottom;
    }
  });
  return axis === "x" ? px : py;
}

export function tickLunaPlayers(
  state: EscapeLunaState,
  inputs: Map<string, PlayerInput>,
  dtSec: number
) {
  state.players.forEach((p, sessionId) => {
    if (!p.alive) return;
    const inp = inputs.get(sessionId);
    if (!inp) return;

    p.aim = inp.aim;
    const speed = PLAYER_SPEED * p.speedScale;
    const radius = PLAYER_RADIUS * p.radiusScale;
    const dx = inp.moveX * speed * dtSec;
    const dy = inp.moveY * speed * dtSec;

    p.x = clamp(p.x + dx, -WORLD_HALF + radius, WORLD_HALF - radius);
    p.x = resolveAgainstObstacles(p.x, p.y, state.obstacles, "x", radius);
    p.y = clamp(p.y + dy, -WORLD_HALF + radius, WORLD_HALF - radius);
    p.y = resolveAgainstObstacles(p.x, p.y, state.obstacles, "y", radius);
  });
}

export function tickLunaZone(
  state: EscapeLunaState,
  dtSec: number,
  nowMs: number
) {
  if (state.status !== "PLAYING") return;
  const total = state.matchEndsAtMs - state.startedAtMs;
  if (total <= 0) return;
  const elapsed = clamp(nowMs - state.startedAtMs, 0, total);
  const t = elapsed / total;

  state.zone.targetRadius =
    LUNA_ZONE_START_RADIUS + (LUNA_ZONE_END_RADIUS - LUNA_ZONE_START_RADIUS) * t;
  state.zone.radius = state.zone.targetRadius;
  state.zoneShrink01 = t;

  const dps = LUNA_ZONE_DPS_START + (LUNA_ZONE_DPS_END - LUNA_ZONE_DPS_START) * t;
  const dmg = dps * dtSec;
  state.players.forEach((p) => {
    if (!p.alive) return;
    const dx = p.x - state.zone.cx;
    const dy = p.y - state.zone.cy;
    if (Math.hypot(dx, dy) > state.zone.radius) {
      p.hp -= dmg;
      if (p.hp <= 0) {
        p.hp = 0;
        p.alive = false;
        p.deathAt = nowMs;
      }
    }
  });
}

function resolveDogAgainstObstacles(state: EscapeLunaState, radius: number) {
  const dog = state.dog;
  dog.x = resolveAgainstObstacles(dog.x, dog.y, state.obstacles, "x", radius);
  dog.y = resolveAgainstObstacles(dog.x, dog.y, state.obstacles, "y", radius);
}

export function spawnLunaDog(state: EscapeLunaState) {
  const dog = state.dog;
  dog.x = state.zone.cx;
  dog.y = state.zone.cy - 120;
  dog.vx = 0;
  dog.vy = 0;
  dog.speed = LUNA_SPEED_START;
  dog.targetSessionId = "";
  dog.catchAtMs = 0;
}

export function tickLunaDog(
  state: EscapeLunaState,
  inputs: Map<string, PlayerInput>,
  dtSec: number,
  nowMs: number
) {
  if (state.status !== "PLAYING") return;
  const dog = state.dog;
  const total = state.matchEndsAtMs - state.startedAtMs;
  if (total <= 0) return;
  const t = clamp((nowMs - state.startedAtMs) / total, 0, 1);

  dog.speed = LUNA_SPEED_START + (LUNA_SPEED_MAX - LUNA_SPEED_START) * Math.pow(t, 0.82);

  let target: Player | null = null;
  let targetSessionId = "";
  let bestDist = Infinity;
  state.players.forEach((p, sessionId) => {
    if (!p.alive || !p.connected) return;
    const d = Math.hypot(p.x - dog.x, p.y - dog.y);
    if (d < bestDist) {
      bestDist = d;
      target = p;
      targetSessionId = sessionId;
    }
  });

  if (!target) return;
  dog.targetSessionId = targetSessionId;

  const inp = inputs.get(targetSessionId);
  let aimX = (target as Player).x;
  let aimY = (target as Player).y;
  if (inp && (inp.moveX !== 0 || inp.moveY !== 0)) {
    aimX += inp.moveX * PLAYER_SPEED * LUNA_PREDICT_SEC;
    aimY += inp.moveY * PLAYER_SPEED * LUNA_PREDICT_SEC;
  }

  const dx = aimX - dog.x;
  const dy = aimY - dog.y;
  const dist = Math.hypot(dx, dy) || 1;
  const desiredVx = (dx / dist) * dog.speed;
  const desiredVy = (dy / dist) * dog.speed;
  const steer = Math.min(1, LUNA_STEER_RATE * dtSec);
  dog.vx += (desiredVx - dog.vx) * steer;
  dog.vy += (desiredVy - dog.vy) * steer;

  dog.x += dog.vx * dtSec;
  dog.y += dog.vy * dtSec;
  resolveDogAgainstObstacles(state, LUNA_RADIUS);

  const catchRadius = LUNA_RADIUS + PLAYER_RADIUS * 0.95;
  state.players.forEach((p) => {
    if (!p.alive) return;
    if (Math.hypot(p.x - dog.x, p.y - dog.y) <= catchRadius) {
      p.alive = false;
      p.deathAt = nowMs;
      dog.catchAtMs = nowMs;
    }
  });
}
