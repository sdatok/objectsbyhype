import { Obstacle, Player } from "./state";
import type { EscapeLunaState } from "./luna-state";
import { LunaBullet } from "./luna-state";
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
  TOWER_PLACEMENTS,
  OBSTACLE_SIZES,
} from "./constants";
import {
  LUNA_CLIFF_CLUSTER_COUNT,
  LUNA_EXTRA_WALL_SEGMENTS,
  LUNA_MAZE_SPOKE_COUNT,
  LUNA_NAV_RADIUS,
  LUNA_PREDICT_SEC,
  LUNA_RADIUS,
  LUNA_RING_WALL_COUNT,
  LUNA_SPEED_MAX,
  LUNA_SPEED_START,
  LUNA_STEER_RATE,
  LUNA_CLOSE_RANGE,
  LUNA_STUCK_JUMP_MS,
  LUNA_STUCK_MOVE_EPS,
  LUNA_PLAYER_PUSH_ITERATIONS,
  LUNA_PLAYER_PUSH_TRANSFER,
  LUNA_SPAWN_CLEAR_RADIUS,
  LUNA_PUPPY_RADIUS,
  LUNA_PUPPY_SPEED,
  LUNA_PUPPY_CATCH_PAD,
  LUNA_INFECTED_SPEED_BONUS,
  LUNA_LAST_SURVIVOR_SPEED_BONUS,
  LUNA_SURVIVOR_SPEED_CAP,
  LUNA_SHOOT_INTERVAL_MS,
  LUNA_SHOOT_DURATION_MS,
  LUNA_SHOOT_BULLET_INTERVAL_MS,
  LUNA_BULLET_SPEED,
  LUNA_BULLET_RADIUS,
  LUNA_BULLET_TTL_MS,
  LUNA_BULLET_SPREAD_RAD,
  LUNA_BULLET_MAX,
  LUNA_ZONE_DPS_END,
  LUNA_ZONE_DPS_START,
  LUNA_ZONE_END_RADIUS,
  LUNA_ZONE_START_RADIUS,
} from "./luna-constants";
import { emptyInput, sanitizeInput, type PlayerInput } from "./physics";

export { emptyInput, sanitizeInput, type PlayerInput };

/** When Luna stops making progress toward her target. */
let lunaDogStuckSinceMs = 0;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

interface ObstacleRect {
  kind: string;
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

/** Vendor towers — solid blockers scattered across the maze. */
function generateVendorTowers(placed: ObstacleRect[]) {
  for (const slot of TOWER_PLACEMENTS) {
    const size = OBSTACLE_SIZES[slot.kind][0];
    if (!size) continue;
    placed.push({
      kind: slot.kind,
      x: slot.x,
      y: slot.y,
      w: size.w,
      h: size.h,
    });
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
  generateVendorTowers(placed);

  for (const p of placed) {
    const o = new Obstacle();
    o.kind = p.kind;
    o.x = p.x;
    o.y = p.y;
    o.w = p.w;
    o.h = p.h;
    state.obstacles.push(o);
  }

  state.pits.clear();

  console.log(
    `[escape-luna] generateLunaMaze placed ${state.obstacles.length} segments`
  );
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

/** Push Luna out of overlapping obstacles using circle-vs-AABB separation. */
function pushCircleOutOfObstacles(
  x: number,
  y: number,
  obstacles: EscapeLunaState["obstacles"],
  radius: number
) {
  let px = x;
  let py = y;
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    obstacles.forEach((o) => {
      const halfW = o.w / 2;
      const halfH = o.h / 2;
      const closestX = clamp(px, o.x - halfW, o.x + halfW);
      const closestY = clamp(py, o.y - halfH, o.y + halfH);
      let dx = px - closestX;
      let dy = py - closestY;
      const distSq = dx * dx + dy * dy;
      if (distSq >= radius * radius) return;

      if (distSq < 1e-6) {
        const leftPen = px - (o.x - halfW - radius);
        const rightPen = o.x + halfW + radius - px;
        const topPen = py - (o.y - halfH - radius);
        const bottomPen = o.y + halfH + radius - py;
        const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);
        if (minPen === leftPen) dx = -1;
        else if (minPen === rightPen) dx = 1;
        else if (minPen === topPen) dy = -1;
        else dy = 1;
        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
      } else {
        const dist = Math.sqrt(distSq);
        dx /= dist;
        dy /= dist;
      }

      const dist = Math.hypot(px - closestX, py - closestY);
      const push = radius - dist + 0.5;
      px += dx * push;
      py += dy * push;
      moved = true;
    });
    if (!moved) break;
  }
  return { x: px, y: py };
}

/**
 * Move Luna with per-axis sliding (like players) plus separation push-out.
 * When blocked, nudge along the best slide direction toward the chase target.
 */
function moveLunaDog(
  dog: { x: number; y: number },
  state: EscapeLunaState,
  dx: number,
  dy: number,
  navRadius: number,
  aimX: number,
  aimY: number
) {
  const obstacles = state.obstacles;
  const prevX = dog.x;
  const prevY = dog.y;

  dog.x += dx;
  dog.x = resolveAgainstObstacles(dog.x, dog.y, obstacles, "x", navRadius);
  dog.y += dy;
  dog.y = resolveAgainstObstacles(dog.x, dog.y, obstacles, "y", navRadius);

  let separated = pushCircleOutOfObstacles(dog.x, dog.y, obstacles, navRadius);
  separated = pushCircleOutOfPits(separated.x, separated.y, state.pits, navRadius);
  dog.x = separated.x;
  dog.y = separated.y;

  const moved = Math.hypot(dog.x - prevX, dog.y - prevY);
  const wanted = Math.hypot(dx, dy);
  if (wanted < 0.5 || moved >= wanted * 0.35) return;

  const toAimX = aimX - dog.x;
  const toAimY = aimY - dog.y;
  const toAimLen = Math.hypot(toAimX, toAimY) || 1;
  const ux = toAimX / toAimLen;
  const uy = toAimY / toAimLen;
  const slideDist = Math.max(wanted, navRadius * 0.45);

  let bestX = dog.x;
  let bestY = dog.y;
  let bestScore = -Infinity;
  const dirs: Array<[number, number]> = [
    [ux, uy],
    [uy, -ux],
    [-uy, ux],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (const [dirX, dirY] of dirs) {
    const len = Math.hypot(dirX, dirY) || 1;
    let nx = dog.x + (dirX / len) * slideDist;
    let ny = dog.y + (dirY / len) * slideDist;
    nx = resolveAgainstObstacles(nx, ny, obstacles, "x", navRadius);
    ny = resolveAgainstObstacles(nx, ny, obstacles, "y", navRadius);
    const sep = pushCircleOutOfObstacles(nx, ny, obstacles, navRadius);
    const sepPits = pushCircleOutOfPits(sep.x, sep.y, state.pits, navRadius);
    nx = sepPits.x;
    ny = sepPits.y;
    const progress = (nx - dog.x) * ux + (ny - dog.y) * uy;
    if (progress > bestScore) {
      bestScore = progress;
      bestX = nx;
      bestY = ny;
    }
  }

  if (bestScore > 0.01) {
    dog.x = bestX;
    dog.y = bestY;
  }
}

function circleOverlapsAnyObstacle(
  x: number,
  y: number,
  obstacles: EscapeLunaState["obstacles"],
  radius: number
) {
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    const halfW = o.w / 2;
    const halfH = o.h / 2;
    const closestX = clamp(x, o.x - halfW, o.x + halfW);
    const closestY = clamp(y, o.y - halfH, o.y + halfH);
    const dx = x - closestX;
    const dy = y - closestY;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}

function circleOverlapsAnyPit(
  x: number,
  y: number,
  pits: EscapeLunaState["pits"],
  radius: number
) {
  for (let i = 0; i < pits.length; i++) {
    const pit = pits[i];
    const dx = x - pit.x;
    const dy = y - pit.y;
    if (dx * dx + dy * dy < (pit.radius + radius) * (pit.radius + radius)) {
      return true;
    }
  }
  return false;
}

function circleBlockedForLuna(
  x: number,
  y: number,
  state: EscapeLunaState,
  navRadius: number
) {
  return (
    circleOverlapsAnyObstacle(x, y, state.obstacles, navRadius) ||
    circleOverlapsAnyPit(x, y, state.pits, navRadius)
  );
}

function pushCircleOutOfPits(
  x: number,
  y: number,
  pits: EscapeLunaState["pits"],
  radius: number
) {
  let px = x;
  let py = y;
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (let i = 0; i < pits.length; i++) {
      const pit = pits[i];
      const minDist = pit.radius + radius;
      let dx = px - pit.x;
      let dy = py - pit.y;
      let dist = Math.hypot(dx, dy);
      if (dist >= minDist) continue;
      if (dist < 1e-6) {
        dx = 1;
        dy = 0;
        dist = 1;
      }
      const push = minDist - dist + 0.5;
      px += (dx / dist) * push;
      py += (dy / dist) * push;
      moved = true;
    }
    if (!moved) break;
  }
  return { x: px, y: py };
}

/** Teleport Luna forward over a blocking wall toward her chase aim. */
function jumpLunaOverObstacle(
  dog: { x: number; y: number; vx: number; vy: number; speed: number },
  state: EscapeLunaState,
  aimX: number,
  aimY: number,
  navRadius: number
) {
  const dx = aimX - dog.x;
  const dy = aimY - dog.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const perpX = -uy;
  const perpY = ux;
  const bounds = WORLD_HALF - navRadius;

  const offsets: Array<[number, number]> = [];
  for (const dist of [140, 200, 260, 340, 420]) {
    offsets.push([ux * dist, uy * dist]);
    offsets.push([ux * dist + perpX * 70, uy * dist + perpY * 70]);
    offsets.push([ux * dist - perpX * 70, uy * dist - perpY * 70]);
  }

  for (const [ox, oy] of offsets) {
    const nx = clamp(dog.x + ox, -bounds, bounds);
    const ny = clamp(dog.y + oy, -bounds, bounds);
    if (Math.hypot(nx - dog.x, ny - dog.y) < 80) continue;
    if (circleBlockedForLuna(nx, ny, state, navRadius)) continue;
    dog.x = nx;
    dog.y = ny;
    dog.vx = ux * dog.speed;
    dog.vy = uy * dog.speed;
    return true;
  }
  return false;
}

function resolveLunaPlayerBumps(
  state: EscapeLunaState,
  inputs: Map<string, PlayerInput>
) {
  type Entry = {
    sessionId: string;
    p: Player;
    radius: number;
    moveX: number;
    moveY: number;
    moving: boolean;
  };

  const entries: Entry[] = [];
  state.players.forEach((p, sessionId) => {
    if (!p.alive) return;
    const inp = inputs.get(sessionId);
    const moveX = inp?.moveX ?? 0;
    const moveY = inp?.moveY ?? 0;
    entries.push({
      sessionId,
      p,
      radius: PLAYER_RADIUS * p.radiusScale,
      moveX,
      moveY,
      moving: Math.hypot(moveX, moveY) > 0.08,
    });
  });

  for (let iter = 0; iter < LUNA_PLAYER_PUSH_ITERATIONS; iter++) {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i]!;
        const b = entries[j]!;
        let dx = b.p.x - a.p.x;
        let dy = b.p.y - a.p.y;
        let dist = Math.hypot(dx, dy);
        const minDist = a.radius + b.radius;
        if (dist >= minDist) continue;
        if (dist < 1e-6) {
          dx = 1;
          dy = 0;
          dist = 1;
        }
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;
        const weightA = 0.35 + (a.moving ? 0.65 : 0);
        const weightB = 0.35 + (b.moving ? 0.65 : 0);
        const total = weightA + weightB;

        a.p.x -= (nx * overlap * weightB) / total;
        a.p.y -= (ny * overlap * weightB) / total;
        b.p.x += (nx * overlap * weightA) / total;
        b.p.y += (ny * overlap * weightA) / total;

        if (a.moving) {
          b.p.x += a.moveX * overlap * LUNA_PLAYER_PUSH_TRANSFER;
          b.p.y += a.moveY * overlap * LUNA_PLAYER_PUSH_TRANSFER;
        }
        if (b.moving) {
          a.p.x -= b.moveX * overlap * LUNA_PLAYER_PUSH_TRANSFER;
          a.p.y -= b.moveY * overlap * LUNA_PLAYER_PUSH_TRANSFER;
        }
      }
    }
  }
}

/** Survivor eliminated — becomes a puppy at their current position. */
export function eliminateToPuppy(p: Player, nowMs: number) {
  if (!p.alive || p.puppyMode) return;
  p.alive = false;
  p.hp = 0;
  p.deathAt = nowMs;
  p.puppyMode = true;
  p.radiusScale = LUNA_PUPPY_RADIUS / PLAYER_RADIUS;
  p.speedScale = LUNA_PUPPY_SPEED / PLAYER_SPEED;
}

function tickLunaPuppies(
  state: EscapeLunaState,
  inputs: Map<string, PlayerInput>,
  dtSec: number,
  nowMs: number
) {
  state.players.forEach((p, sessionId) => {
    if (!p.puppyMode || p.alive) return;
    const inp = inputs.get(sessionId);
    if (!inp) return;

    p.aim = inp.aim;
    const speed = LUNA_PUPPY_SPEED;
    const radius = LUNA_PUPPY_RADIUS;
    const dx = inp.moveX * speed * dtSec;
    const dy = inp.moveY * speed * dtSec;

    p.x += dx;
    p.x = resolveAgainstObstacles(p.x, p.y, state.obstacles, "x", radius);
    p.y += dy;
    p.y = resolveAgainstObstacles(p.x, p.y, state.obstacles, "y", radius);
  });

  state.players.forEach((puppy) => {
    if (!puppy.puppyMode || puppy.alive) return;
    state.players.forEach((target) => {
      if (!target.alive || target.puppyMode) return;
      const catchR =
        LUNA_PUPPY_RADIUS + PLAYER_RADIUS * target.radiusScale * LUNA_PUPPY_CATCH_PAD;
      if (Math.hypot(target.x - puppy.x, target.y - puppy.y) <= catchR) {
        eliminateToPuppy(target, nowMs);
      }
    });
  });
}

/** Furthest spawn distance that stays on the walkable floor (zone ∩ world square). */
export function maxLunaSpawnRadius(state: EscapeLunaState): number {
  const pad = PLAYER_RADIUS * 2 + 32;
  const zoneLimit = state.zone.radius - pad;
  const worldLimit = WORLD_HALF - pad;
  return Math.max(160, Math.min(zoneLimit, worldLimit));
}

/** True when a player can stand here without instantly falling. */
export function isSafeLunaSpawnPoint(
  state: EscapeLunaState,
  x: number,
  y: number
): boolean {
  const radius = PLAYER_RADIUS;
  if (Math.hypot(x - state.zone.cx, y - state.zone.cy) > state.zone.radius - radius * 0.5) {
    return false;
  }
  if (Math.abs(x) > WORLD_HALF - radius * 0.5 || Math.abs(y) > WORLD_HALF - radius * 0.5) {
    return false;
  }
  if (Math.hypot(x, y) < 180) return false;

  const lunaDx = x - state.dog.x;
  const lunaDy = y - state.dog.y;
  if (Math.hypot(lunaDx, lunaDy) < LUNA_SPAWN_CLEAR_RADIUS) return false;

  for (let i = 0; i < state.obstacles.length; i++) {
    const o = state.obstacles[i]!;
    if (
      x > o.x - o.w / 2 - radius - 8 &&
      x < o.x + o.w / 2 + radius + 8 &&
      y > o.y - o.h / 2 - radius - 8 &&
      y < o.y + o.h / 2 + radius + 8
    ) {
      return false;
    }
  }

  return true;
}

export function tickLunaPlayers(
  state: EscapeLunaState,
  inputs: Map<string, PlayerInput>,
  dtSec: number,
  nowMs: number
) {
  const infectedMult = infectedSurvivorSpeedMult(state);

  state.players.forEach((p, sessionId) => {
    if (!p.alive) return;
    const inp = inputs.get(sessionId);
    if (!inp) return;

    p.aim = inp.aim;
    const speed = PLAYER_SPEED * infectedMult;
    const radius = PLAYER_RADIUS * p.radiusScale;
    const dx = inp.moveX * speed * dtSec;
    const dy = inp.moveY * speed * dtSec;

    p.x += dx;
    p.x = resolveAgainstObstacles(p.x, p.y, state.obstacles, "x", radius);
    p.y += dy;
    p.y = resolveAgainstObstacles(p.x, p.y, state.obstacles, "y", radius);
    p.x = clamp(p.x, -WORLD_HALF + radius, WORLD_HALF - radius);
    p.y = clamp(p.y, -WORLD_HALF + radius, WORLD_HALF - radius);
  });

  resolveLunaPlayerBumps(state, inputs);

  state.players.forEach((p) => {
    if (!p.alive) return;
    const radius = PLAYER_RADIUS * p.radiusScale;
    p.x = resolveAgainstObstacles(p.x, p.y, state.obstacles, "x", radius);
    p.y = resolveAgainstObstacles(p.x, p.y, state.obstacles, "y", radius);
    p.x = clamp(p.x, -WORLD_HALF + radius, WORLD_HALF - radius);
    p.y = clamp(p.y, -WORLD_HALF + radius, WORLD_HALF - radius);
  });

  tickLunaPuppies(state, inputs, dtSec, nowMs);
}

export function countLunaPuppies(state: EscapeLunaState): number {
  let n = 0;
  state.players.forEach((p) => {
    if (p.puppyMode && !p.alive) n++;
  });
  return n;
}

export function countLunaSurvivors(state: EscapeLunaState): number {
  let n = 0;
  state.players.forEach((p) => {
    if (p.alive) n++;
  });
  return n;
}

/** Faster survivors as the puppy swarm grows; big boost for the last runner. */
export function infectedSurvivorSpeedMult(state: EscapeLunaState): number {
  const survivors = countLunaSurvivors(state);
  if (survivors === 0) return 1;
  const puppies = countLunaPuppies(state);
  if (puppies === 0) return 1;
  const infection01 = puppies / (puppies + survivors);
  let mult = 1 + infection01 * LUNA_INFECTED_SPEED_BONUS;
  if (survivors === 1) {
    mult += LUNA_LAST_SURVIVOR_SPEED_BONUS;
  }
  return Math.min(LUNA_SURVIVOR_SPEED_CAP, mult);
}

function spawnLunaBullet(
  state: EscapeLunaState,
  x: number,
  y: number,
  angle: number,
  nowMs: number
) {
  while (state.bullets.length >= LUNA_BULLET_MAX) {
    state.bullets.shift();
  }
  const spread = (Math.random() - 0.5) * LUNA_BULLET_SPREAD_RAD;
  const a = angle + spread;
  const muzzle = LUNA_RADIUS + 10;
  const b = new LunaBullet();
  b.x = x + Math.cos(a) * muzzle;
  b.y = y + Math.sin(a) * muzzle;
  b.vx = Math.cos(a) * LUNA_BULLET_SPEED;
  b.vy = Math.sin(a) * LUNA_BULLET_SPEED;
  b.spawnedAtMs = nowMs;
  state.bullets.push(b);
}

export function tickLunaBullets(
  state: EscapeLunaState,
  dtSec: number,
  nowMs: number
) {
  if (state.status !== "PLAYING") return;

  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i]!;
    b.x += b.vx * dtSec;
    b.y += b.vy * dtSec;

    if (nowMs - b.spawnedAtMs > LUNA_BULLET_TTL_MS) {
      state.bullets.splice(i, 1);
      continue;
    }
    if (
      Math.abs(b.x) > WORLD_HALF + 80 ||
      Math.abs(b.y) > WORLD_HALF + 80
    ) {
      state.bullets.splice(i, 1);
      continue;
    }

    let hit = false;
    state.players.forEach((p) => {
      if (hit || !p.alive) return;
      const r = PLAYER_RADIUS * p.radiusScale + LUNA_BULLET_RADIUS;
      if (Math.hypot(p.x - b.x, p.y - b.y) <= r) {
        eliminateToPuppy(p, nowMs);
        hit = true;
      }
    });
    if (hit) {
      state.bullets.splice(i, 1);
    }
  }
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
    const radius = PLAYER_RADIUS * p.radiusScale;
    const dx = p.x - state.zone.cx;
    const dy = p.y - state.zone.cy;
    const edgeDist = Math.hypot(dx, dy);
    if (edgeDist <= state.zone.radius) return;
    p.hp -= dmg;
    if (p.hp <= 0) {
      p.hp = 0;
      eliminateToPuppy(p, nowMs);
    }
  });
}

function resolveDogAgainstObstacles(state: EscapeLunaState, radius: number) {
  const dog = state.dog;
  let separated = pushCircleOutOfObstacles(
    dog.x,
    dog.y,
    state.obstacles,
    radius
  );
  separated = pushCircleOutOfPits(separated.x, separated.y, state.pits, radius);
  dog.x = separated.x;
  dog.y = separated.y;
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
  dog.jumpAtMs = 0;
  dog.shootUntilMs = 0;
  dog.aimAngle = 0;
  dog.lastBulletAtMs = 0;
  dog.nextBarrageAtMs = 0;
  lunaDogStuckSinceMs = 0;
  state.bullets.clear();
}

function findNearestSurvivor(
  state: EscapeLunaState,
  fromX: number,
  fromY: number
): Player | null {
  let best: Player | null = null;
  let bestDist = Infinity;
  state.players.forEach((p) => {
    if (!p.alive) return;
    const d = Math.hypot(p.x - fromX, p.y - fromY);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  });
  return best;
}

function tickLunaShooting(
  state: EscapeLunaState,
  nowMs: number
): boolean {
  const dog = state.dog;
  if (state.startedAtMs <= 0) return false;

  if (dog.nextBarrageAtMs <= 0) {
    dog.nextBarrageAtMs = state.startedAtMs + LUNA_SHOOT_INTERVAL_MS;
  }

  if (nowMs >= dog.nextBarrageAtMs && nowMs >= dog.shootUntilMs) {
    dog.shootUntilMs = nowMs + LUNA_SHOOT_DURATION_MS;
    dog.nextBarrageAtMs = nowMs + LUNA_SHOOT_INTERVAL_MS;
    dog.lastBulletAtMs = 0;
  }

  if (nowMs >= dog.shootUntilMs) return false;

  dog.vx = 0;
  dog.vy = 0;
  lunaDogStuckSinceMs = 0;

  const target = findNearestSurvivor(state, dog.x, dog.y);
  if (target) {
    dog.aimAngle = Math.atan2(target.y - dog.y, target.x - dog.x);
  }

  if (
    dog.lastBulletAtMs <= 0 ||
    nowMs - dog.lastBulletAtMs >= LUNA_SHOOT_BULLET_INTERVAL_MS
  ) {
    spawnLunaBullet(state, dog.x, dog.y, dog.aimAngle, nowMs);
    dog.lastBulletAtMs = nowMs;
  }

  resolveDogAgainstObstacles(state, LUNA_NAV_RADIUS);
  return true;
}

export function tickLunaDog(
  state: EscapeLunaState,
  inputs: Map<string, PlayerInput>,
  dtSec: number,
  nowMs: number
) {
  if (state.status !== "PLAYING") return;
  const dog = state.dog;

  if (tickLunaShooting(state, nowMs)) {
    return;
  }

  const total = state.matchEndsAtMs - state.startedAtMs;
  if (total <= 0) return;
  const t = clamp((nowMs - state.startedAtMs) / total, 0, 1);

  dog.speed = LUNA_SPEED_START + (LUNA_SPEED_MAX - LUNA_SPEED_START) * Math.pow(t, 0.62);

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

  const targetPlayer = target as Player;
  const inp = inputs.get(targetSessionId);
  let aimX = targetPlayer.x;
  let aimY = targetPlayer.y;
  if (inp && (inp.moveX !== 0 || inp.moveY !== 0)) {
    const targetSpeed = PLAYER_SPEED * targetPlayer.speedScale;
    const predictSec =
      LUNA_PREDICT_SEC + Math.min(0.35, bestDist / 900) + (bestDist < LUNA_CLOSE_RANGE ? 0.12 : 0);
    aimX += inp.moveX * targetSpeed * predictSec;
    aimY += inp.moveY * targetSpeed * predictSec;
    // Cut off perpendicular escape — blend toward flank intercept.
    const perpX = -inp.moveY;
    const perpY = inp.moveX;
    const flankScale = Math.min(120, bestDist * 0.18);
    aimX = aimX * 0.78 + (targetPlayer.x + perpX * flankScale) * 0.22;
    aimY = aimY * 0.78 + (targetPlayer.y + perpY * flankScale) * 0.22;
  }

  let chaseSpeed = dog.speed;
  if (bestDist < LUNA_CLOSE_RANGE) {
    chaseSpeed += ((LUNA_CLOSE_RANGE - bestDist) / LUNA_CLOSE_RANGE) * 35;
  }

  const toAimDx = aimX - dog.x;
  const toAimDy = aimY - dog.y;
  const dist = Math.hypot(toAimDx, toAimDy) || 1;
  const desiredVx = (toAimDx / dist) * chaseSpeed;
  const desiredVy = (toAimDy / dist) * chaseSpeed;
  const steer = Math.min(1, LUNA_STEER_RATE * dtSec);
  dog.vx += (desiredVx - dog.vx) * steer;
  dog.vy += (desiredVy - dog.vy) * steer;
  dog.speed = chaseSpeed;

  const prevX = dog.x;
  const prevY = dog.y;

  moveLunaDog(
    dog,
    state,
    dog.vx * dtSec,
    dog.vy * dtSec,
    LUNA_NAV_RADIUS,
    aimX,
    aimY
  );
  resolveDogAgainstObstacles(state, LUNA_NAV_RADIUS);

  const movedThisTick = Math.hypot(dog.x - prevX, dog.y - prevY);
  const wantsToMove = chaseSpeed > 30;
  if (movedThisTick < LUNA_STUCK_MOVE_EPS && wantsToMove) {
    if (lunaDogStuckSinceMs === 0) lunaDogStuckSinceMs = nowMs;
  } else {
    lunaDogStuckSinceMs = 0;
  }

  if (
    lunaDogStuckSinceMs > 0 &&
    nowMs - lunaDogStuckSinceMs >= LUNA_STUCK_JUMP_MS
  ) {
    if (
      jumpLunaOverObstacle(
        dog,
        state,
        aimX,
        aimY,
        LUNA_NAV_RADIUS
      )
    ) {
      dog.jumpAtMs = nowMs;
      lunaDogStuckSinceMs = 0;
      console.log("[escape-luna] Luna jumped over obstacle");
    } else {
      lunaDogStuckSinceMs = nowMs - LUNA_STUCK_JUMP_MS + 500;
    }
  }

  const catchRadius = LUNA_RADIUS + PLAYER_RADIUS * 0.82;
  state.players.forEach((p) => {
    if (!p.alive) return;
    if (Math.hypot(p.x - dog.x, p.y - dog.y) <= catchRadius) {
      eliminateToPuppy(p, nowMs);
      dog.catchAtMs = nowMs;
    }
  });
}
