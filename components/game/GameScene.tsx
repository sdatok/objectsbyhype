"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { PerspectiveCamera, RoundedBox } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

// Module-level cache so repeated drops of the same product image reuse one
// texture instead of refetching / re-decoding for every task spawn.
const textureCache = new Map<string, THREE.Texture>();

function loadProductTexture(url: string): THREE.Texture {
  const cached = textureCache.get(url);
  if (cached) return cached;
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  const tex = loader.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(url, tex);
  return tex;
}

export type StationId = "computer" | "packing" | "camera";

export const STATION_IDS: StationId[] = ["computer", "packing", "camera"];

export const STATION_LABELS: Record<StationId, string> = {
  computer: "LIST IT",
  packing: "PACK IT",
  camera: "SHOOT IT",
};

export interface ActiveTask {
  id: string;
  stationId: StationId;
  /** Index into `productImageUrls` — chosen at spawn time. */
  imageIndex: number;
  spawnedAt: number;
  expiresAt: number;
}

const STATION_POSITIONS: Record<StationId, [number, number, number]> = {
  computer: [-3.6, 0, 0],
  packing: [0, 0, 0],
  camera: [3.6, 0, 0],
};

// Character stands slightly in front of each station; ROTATIONS face them
// toward the station so they look like they're working it.
const CHARACTER_ROTATIONS: Record<StationId, number> = {
  // Computer is on the left → character turns slightly right toward it.
  computer: -Math.PI / 5,
  // Packing center → faces straight away (back to camera) to interact with the box.
  packing: Math.PI,
  // Camera/phone is on the right → character turns slightly left toward it.
  camera: Math.PI / 5,
};

const COLORS = {
  floor: "#f7f5fb",
  floorAccent: "#ede9fe",
  desk: "#1a0b2e",
  panel: "#2a154d",
  outline: "#c026d3",
  neonHot: "#e879f9",
  neonCool: "#7c3aed",
  flameInner: "#fde68a",
  flameOuter: "#c026d3",
  flameMid: "#e879f9",
  white: "#ffffff",
  redBox: "#dc2626",
  denim: "#1e293b",
  // Pink BAPE ABC camo palette — matches the reference image.
  bapePinkBase: "#fbcfe8",
  bapePinkMid: "#f472b6",
  bapePinkHot: "#ec4899",
  bapePinkRed: "#be123c",
  silver: "#cbd5e1",
  glass: "#0f172a",
  shirtBlack: "#0a0a0a",
  warning: "#fb7185",
};

interface GameSceneProps {
  tasks: ActiveTask[];
  characterAt: StationId;
  flashStation: StationId | null;
  cameraFlash: boolean;
  productImageUrls: string[];
  onStationClick: (id: StationId, input?: { trusted?: boolean }) => void;
  /** When true, block browser pan/zoom gestures on the canvas (active round). */
  lockTouch?: boolean;
}

export default function GameScene(props: GameSceneProps) {
  const { lockTouch = false, ...sceneProps } = props;
  return (
    <Canvas
      shadows={false}
      // Cap DPR a touch lower than default — keeps fps high on dense phone
      // displays without a visible loss of crispness for this style.
      dpr={[1, 1.4]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor(COLORS.white);
        scene.background = new THREE.Color(COLORS.white);
        gl.toneMapping = THREE.NoToneMapping;
      }}
      style={{ touchAction: lockTouch ? "none" : "manipulation" }}
      frameloop="always"
    >
      <ResponsiveCamera />

      {/* Bright studio-style lighting now that the bg is white. One ambient +
          one directional is plenty — saved a couple shader passes for mobile. */}
      <ambientLight intensity={1.05} />
      <directionalLight position={[5, 8, 5]} intensity={0.65} />

      <SkylineBackdrop />
      <Floor />
      <BackFlames />

      {STATION_IDS.map((id) => (
        <Workstation
          key={id}
          stationId={id}
          position={STATION_POSITIONS[id]}
          highlighted={props.flashStation === id}
          cameraFlash={id === "camera" && props.cameraFlash}
          onClick={(e) =>
            props.onStationClick(id, {
              trusted: (e.nativeEvent as MouseEvent).isTrusted,
            })
          }
        />
      ))}

      <Character at={props.characterAt} />

      {props.tasks.map((task) => (
        <Task key={task.id} task={task} imageUrls={props.productImageUrls} />
      ))}
    </Canvas>
  );
}

/** Picks an FOV + camera distance that keeps the whole scene (~12 units wide,
 *  including the side flames) in frame for any viewport aspect ratio. Without
 *  this, narrow phone viewports clip the left/right stations. */
function ResponsiveCamera() {
  const size = useThree((s) => s.size);
  const aspect = Math.max(0.4, size.width / Math.max(1, size.height));
  // Wider FOV on narrow viewports so side stations remain visible without
  // pulling the camera so far back that the character becomes a dot.
  const fov =
    aspect < 0.75
      ? 62
      : aspect < 1.0
        ? 56
        : aspect < 1.35
          ? 48
          : aspect < 1.7
            ? 42
            : 38;

  // Distance required to fit `targetHalfWidth` units horizontally.
  const targetHalfWidth = 5.8;
  const vFov = THREE.MathUtils.degToRad(fov);
  const hFovHalf = Math.atan(Math.tan(vFov / 2) * aspect);
  const z = targetHalfWidth / Math.tan(hFovHalf);

  // Slightly higher camera on tight aspects so the floor doesn't dominate.
  const y = 3.6 + (1 - Math.min(1, aspect / 1.6)) * 1.6;

  // Pitch so the camera looks at the world point (0, 1.0, 0) — the chest
  // height of the action — without us having to call `camera.lookAt(...)`.
  const lookAtY = 1.0;
  const tiltDown = Math.atan2(y - lookAtY, z);

  return (
    <PerspectiveCamera
      makeDefault
      fov={fov}
      position={[0, y, z]}
      rotation={[-tiltDown, 0, 0]}
      near={0.1}
      far={100}
    />
  );
}

function Floor() {
  // Authentic-ish BAPE ABC camo: irregular splotches mixed with hidden ape-head
  // silhouettes (round head + ears + cheek puffs). Kept light grey so the
  // action on top stays readable.
  const camoTex = useCanvasTexture(
    512,
    512,
    (ctx, w, h) => {
      // Light base
      ctx.fillStyle = "#ededf0";
      ctx.fillRect(0, 0, w, h);
      const palette = ["#c7c7cc", "#9a9aa3", "#7d7d87", "#b6b6bd"];

      // ----- Helper: ape head silhouette built out of overlapping circles
      function drawApe(cx: number, cy: number, size: number, color: string) {
        ctx.fillStyle = color;
        // Main head
        ctx.beginPath();
        ctx.arc(cx, cy, size, 0, Math.PI * 2);
        ctx.fill();
        // Two ears at the top sides
        ctx.beginPath();
        ctx.arc(cx - size * 0.75, cy - size * 0.55, size * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + size * 0.75, cy - size * 0.55, size * 0.42, 0, Math.PI * 2);
        ctx.fill();
        // Cheek puffs
        ctx.beginPath();
        ctx.arc(cx - size * 0.95, cy + size * 0.25, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + size * 0.95, cy + size * 0.25, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        // Chin
        ctx.beginPath();
        ctx.arc(cx, cy + size * 0.7, size * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }

      // ----- Background splotch layer
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = palette[i % palette.length];
        const r = 16 + Math.random() * 22;
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // ----- Ape head silhouettes mixed in
      for (let i = 0; i < 14; i++) {
        const color = palette[i % palette.length];
        const size = 20 + Math.random() * 18;
        drawApe(Math.random() * w, Math.random() * h, size, color);
      }
    },
    {
      setup: (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(5, 2);
      },
    }
  );

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <planeGeometry args={[40, 16]} />
      <meshStandardMaterial map={camoTex} />
    </mesh>
  );
}

/** Pixel-art Miami Nights skyline backdrop.
 *
 *  Positioning math: the plane is centered at y=PLANE_CENTER_Y so that
 *  canvas-y = SKYLINE_BASE_FRAC (where the building bases sit) maps to
 *  world y = 0 (the floor). Anything below that on the canvas would be
 *  occluded by the floor, so we intentionally keep buildings + horizon
 *  above that line.
 */
function SkylineBackdrop() {
  const PLANE_W = 80;
  const PLANE_H = 14;
  // Where the building bases sit in canvas-Y (0=top, 1=bottom).
  const SKYLINE_BASE_FRAC = 0.92;
  // Plane center chosen so canvas-y=SKYLINE_BASE_FRAC == world y=0 (floor).
  const PLANE_CENTER_Y = (SKYLINE_BASE_FRAC - 0.5) * PLANE_H;

  const skyTex = useCanvasTexture(2048, 768, (ctx, w, h) => {
    // ---- Sunset gradient (Miami Nights palette) ----
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0.0, "#1a0b33"); // deep purple top
    sky.addColorStop(0.4, "#7c1d6f"); // magenta band
    sky.addColorStop(0.65, "#f97316"); // orange horizon
    sky.addColorStop(0.88, "#fcd34d"); // warm yellow near horizon
    sky.addColorStop(1.0, "#7c1d6f"); // brief pull-back so the foot of the
    ctx.fillStyle = sky; // canvas isn't a dead white line where the floor cuts it
    ctx.fillRect(0, 0, w, h);

    // ---- Pixel sun on the horizon — small, sits above the skyline ----
    const sunCx = w * 0.5;
    const sunCy = h * 0.62;
    const sunR = 38;
    for (let r = sunR; r >= 0; r -= 5) {
      const ratio = r / sunR;
      ctx.fillStyle = `rgb(${255}, ${Math.floor(180 + 60 * (1 - ratio))}, ${Math.floor(120 * (1 - ratio))})`;
      ctx.beginPath();
      ctx.arc(sunCx, sunCy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Classic horizon stripes through the sun
    ctx.fillStyle = "#1a0b33";
    for (let y = sunCy + 3; y < sunCy + sunR; y += 7) {
      ctx.fillRect(sunCx - sunR, y, sunR * 2, 2);
    }

    // ---- Lots of tiny pixel stars in the upper sky ----
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 220; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h * 0.4;
      const s = Math.random() > 0.85 ? 3 : 2;
      ctx.fillRect(x, y, s, s);
    }

    // ---- Pixelated city skyline — small + dense ----
    function drawCityRow(
      baseColor: string,
      windowColor: string,
      heightRange: [number, number],
      widthRange: [number, number],
      baseY: number
    ) {
      let x = 0;
      while (x < w) {
        const bw = widthRange[0] + Math.random() * (widthRange[1] - widthRange[0]);
        const bh = heightRange[0] + Math.random() * (heightRange[1] - heightRange[0]);
        ctx.fillStyle = baseColor;
        ctx.fillRect(Math.floor(x), Math.floor(baseY - bh), Math.floor(bw), Math.floor(bh));
        // Antenna / notch
        if (Math.random() > 0.5) {
          const nW = 3 + Math.floor(Math.random() * 5);
          const nH = 8 + Math.floor(Math.random() * 14);
          ctx.fillRect(
            Math.floor(x + bw / 2 - nW / 2),
            Math.floor(baseY - bh - nH),
            nW,
            nH
          );
        }
        // Lit windows
        const winRows = Math.floor(bh / 9);
        const winCols = Math.floor(bw / 7);
        for (let row = 0; row < winRows; row++) {
          for (let col = 0; col < winCols; col++) {
            if (Math.random() > 0.5) continue;
            ctx.fillStyle = windowColor;
            ctx.fillRect(
              Math.floor(x + 2 + col * 7),
              Math.floor(baseY - bh + 3 + row * 9),
              3,
              4
            );
          }
        }
        x += bw + 1;
      }
    }

    const baseY = h * SKYLINE_BASE_FRAC;

    // Back row — tallest but still smaller than before, dark violet
    drawCityRow("#2a0b4d", "#fde68a", [40, 110], [14, 38], baseY - 4);
    // Mid row — medium height, near-black with hot pink windows
    drawCityRow("#15052a", "#f472b6", [25, 80], [12, 32], baseY - 2);
    // Front row — shorter foreground buildings, very dark with cyan windows
    drawCityRow("#070111", "#22d3ee", [18, 55], [10, 26], baseY);
  });

  return (
    <mesh position={[0, PLANE_CENTER_Y, -5]}>
      <planeGeometry args={[PLANE_W, PLANE_H]} />
      <meshBasicMaterial map={skyTex} toneMapped={false} />
    </mesh>
  );
}

// ---------- Pixel-art flame ----------

/** A flame drawn out of tiny voxel cubes. Each row gets fewer pixels going
 *  up, with some asymmetry so it doesn't look like a perfect triangle. */
const FLAME_PIXELS: Array<{ x: number; y: number; tone: "inner" | "mid" | "outer" }> = [
  // bottom (widest)
  { x: -1, y: 0, tone: "outer" },
  { x: 0, y: 0, tone: "outer" },
  { x: 1, y: 0, tone: "outer" },
  { x: -1, y: 1, tone: "outer" },
  { x: 0, y: 1, tone: "mid" },
  { x: 1, y: 1, tone: "outer" },
  // middle
  { x: -1, y: 2, tone: "mid" },
  { x: 0, y: 2, tone: "inner" },
  { x: 1, y: 2, tone: "mid" },
  { x: 0, y: 3, tone: "mid" },
  { x: 1, y: 3, tone: "outer" },
  // tip
  { x: 0, y: 4, tone: "outer" },
  // little flicked-off ember to the side
  { x: -2, y: 1, tone: "outer" },
  { x: 2, y: 2, tone: "outer" },
];

function BackFlames() {
  // Six flames flanking the scene at ~z = -1.8.
  const positions: [number, number, number][] = [
    [-5.6, 0, -1.6],
    [-4.6, 0, -1.6],
    [-3.6, 0, -1.6],
    [3.6, 0, -1.6],
    [4.6, 0, -1.6],
    [5.6, 0, -1.6],
  ];
  return (
    <group>
      {positions.map((p, i) => (
        <PixelFlame key={i} position={p} seed={i * 0.7} />
      ))}
    </group>
  );
}

function PixelFlame({
  position,
  seed,
}: {
  position: [number, number, number];
  seed: number;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime + seed;
    // Stretch vertically and quiver horizontally a touch — classic flame flicker.
    const sx = 1 + Math.sin(t * 8) * 0.05;
    const sy = 1 + Math.sin(t * 6) * 0.1;
    ref.current.scale.set(sx, sy, 1);
  });

  const pixel = 0.15; // each "pixel" cube size in world units

  return (
    <group ref={ref} position={position}>
      {FLAME_PIXELS.map((p, i) => {
        const color =
          p.tone === "inner"
            ? COLORS.flameInner
            : p.tone === "mid"
              ? COLORS.flameMid
              : COLORS.flameOuter;
        return (
          <mesh
            key={i}
            position={[p.x * pixel, p.y * pixel + pixel / 2, 0]}
          >
            <boxGeometry args={[pixel, pixel, pixel]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

// ---------- Workstations ----------

interface WorkstationProps {
  stationId: StationId;
  position: [number, number, number];
  highlighted: boolean;
  cameraFlash: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}

function Workstation({
  stationId,
  position,
  highlighted,
  cameraFlash,
  onClick,
}: WorkstationProps) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const target = highlighted ? 1.08 : 1;
    const current = groupRef.current.scale.x;
    const next = current + (target - current) * Math.min(1, delta * 10);
    groupRef.current.scale.setScalar(next);
  });

  return (
    <group ref={groupRef} position={position} onClick={onClick}>
      {/* Hit target so taps don't have to land on a 3D mesh */}
      <mesh position={[0, 1.2, 0]} visible={false}>
        <boxGeometry args={[3, 3, 3]} />
        <meshBasicMaterial />
      </mesh>

      <StationGlow active={highlighted} />

      {stationId === "computer" && <ComputerStation highlighted={highlighted} />}
      {stationId === "packing" && <PackingStation highlighted={highlighted} />}
      {stationId === "camera" && <PhotoStation flashing={cameraFlash} />}
    </group>
  );
}

function StationGlow({ active }: { active: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const pulse = active
      ? 0.5 + Math.sin(t * 10) * 0.25
      : 0.15 + Math.sin(t * 2) * 0.04;
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = pulse;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
      <ringGeometry args={[1.1, 1.55, 32]} />
      <meshBasicMaterial
        color={COLORS.neonHot}
        transparent
        opacity={0.18}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

interface CanvasTextureOptions {
  /** Optional setup pass run once on the texture — useful for wrap/repeat. */
  setup?: (tex: THREE.CanvasTexture) => void;
}

function useCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  options?: CanvasTextureOptions
): THREE.Texture {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (ctx) draw(ctx, width, height);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    options?.setup?.(tex);
    return tex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function Desk() {
  return (
    <group>
      <RoundedBox args={[2.3, 0.12, 1.25]} radius={0.04} smoothness={3} position={[0, 0.7, 0]}>
        <meshStandardMaterial color={COLORS.desk} />
      </RoundedBox>
      {/* Front edge neon */}
      <mesh position={[0, 0.7, 0.625]}>
        <boxGeometry args={[2.3, 0.04, 0.02]} />
        <meshBasicMaterial color={COLORS.outline} />
      </mesh>
      {([
        [-1, 0.35, 0.5],
        [1, 0.35, 0.5],
        [-1, 0.35, -0.5],
        [1, 0.35, -0.5],
      ] as [number, number, number][]).map((p, i) => (
        <RoundedBox
          key={i}
          args={[0.12, 0.7, 0.12]}
          radius={0.02}
          smoothness={2}
          position={p}
        >
          <meshStandardMaterial color={COLORS.desk} />
        </RoundedBox>
      ))}
    </group>
  );
}

function ComputerStation({ highlighted }: { highlighted: boolean }) {
  const screenTexture = useCanvasTexture(512, 320, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#1a0633");
    grad.addColorStop(1, "#3b0a6b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#86efac";
    ctx.font = "bold 130px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$ $ $", w / 2, h / 2 - 50);

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 56px 'Press Start 2P', system-ui, sans-serif";
    ctx.fillText("INTERNET", w / 2, h / 2 + 55);
    ctx.fillStyle = "#e879f9";
    ctx.fillText("MONEY", w / 2, h / 2 + 115);
  });

  // Bright green "+ $$$" pops up above the screen each time the station is
  // clicked, then floats up and fades. Same trick as the box-lid animation:
  // we capture the rising edge of `highlighted` and run a 700ms animation.
  const popRef = useRef<THREE.Group>(null);
  const popMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const popAnimRef = useRef<number | null>(null);
  const lastHighlightRef = useRef(false);
  const popTex = useCanvasTexture(256, 96, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#22c55e";
    ctx.font = "bold 78px 'Press Start 2P', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("+$$$", w / 2, h / 2);
  });

  // Overlay material that brightens the screen green on click.
  const overlayRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((_, delta) => {
    if (highlighted && !lastHighlightRef.current) {
      // Rising edge — kick off the pop animation.
      popAnimRef.current = performance.now();
    }
    lastHighlightRef.current = highlighted;

    // Green screen flash overlay — lerps in on highlight, out on release.
    if (overlayRef.current) {
      const target = highlighted ? 0.55 : 0;
      const cur = overlayRef.current.opacity;
      overlayRef.current.opacity =
        cur + (target - cur) * Math.min(1, delta * 14);
    }

    // Dollar pop animation
    if (popRef.current && popMatRef.current) {
      if (popAnimRef.current === null) {
        popRef.current.scale.setScalar(0);
        popMatRef.current.opacity = 0;
      } else {
        const t = (performance.now() - popAnimRef.current) / 700;
        if (t >= 1) {
          popAnimRef.current = null;
          popRef.current.scale.setScalar(0);
          popMatRef.current.opacity = 0;
        } else {
          // Pop in (0 → 1.2) then settle (1.2 → 1) over t
          const s = t < 0.25 ? (t / 0.25) * 1.2 : 1.2 - (t - 0.25) * 0.25;
          popRef.current.scale.set(s, s, 1);
          popRef.current.position.y = 1.95 + t * 0.55; // float up
          popMatRef.current.opacity = 1 - t * t;
        }
      }
    }
  });

  return (
    <group>
      <Desk />
      {/* Monitor bezel — rounded */}
      <RoundedBox args={[1.3, 0.86, 0.08]} radius={0.04} smoothness={3} position={[0, 1.38, -0.05]}>
        <meshStandardMaterial color={COLORS.panel} />
      </RoundedBox>
      {/* Glowing screen */}
      <mesh position={[0, 1.38, 0.0]}>
        <boxGeometry args={[1.12, 0.68, 0.02]} />
        <meshBasicMaterial map={screenTexture} toneMapped={false} />
      </mesh>
      {/* Green flash overlay — fades in on click */}
      <mesh position={[0, 1.38, 0.012]}>
        <planeGeometry args={[1.12, 0.68]} />
        <meshBasicMaterial
          ref={overlayRef}
          color="#22c55e"
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>
      {/* Stand */}
      <RoundedBox args={[0.2, 0.32, 0.12]} radius={0.03} smoothness={3} position={[0, 0.95, -0.1]}>
        <meshStandardMaterial color={COLORS.panel} />
      </RoundedBox>
      {/* Keyboard */}
      <RoundedBox args={[0.95, 0.05, 0.32]} radius={0.02} smoothness={2} position={[0, 0.78, 0.32]}>
        <meshStandardMaterial color={COLORS.panel} />
      </RoundedBox>
      <mesh position={[0, 0.81, 0.32]}>
        <boxGeometry args={[0.92, 0.005, 0.02]} />
        <meshBasicMaterial color={COLORS.neonHot} />
      </mesh>

      {/* Floating "+$$$" pop-up sits above the monitor on click */}
      <group ref={popRef} position={[0, 1.95, 0.05]} scale={[0, 0, 1]}>
        <mesh>
          <planeGeometry args={[0.9, 0.34]} />
          <meshBasicMaterial
            ref={popMatRef}
            map={popTex}
            transparent
            opacity={0}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

function PackingStation({ highlighted }: { highlighted: boolean }) {
  // Bigger, higher-res canvas so SHIP IT stays crisp at all sizes — the old
  // 256x160 was clipping the type at smaller render sizes.
  const labelTex = useCanvasTexture(512, 224, (ctx, w, h) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#0b0214";
    ctx.font = "900 64px 'Press Start 2P', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SHIP IT", w / 2, h / 2 - 18);
    ctx.fillStyle = "#c026d3";
    ctx.font = "bold 26px 'Press Start 2P', system-ui, sans-serif";
    ctx.fillText("OBH", w / 2, h / 2 + 56);
  });

  // Lid animation — captures rising edge of `highlighted` and runs a brief
  // open-then-close motion over ~520ms so the box visibly snaps when you tap.
  const lidRef = useRef<THREE.Group>(null);
  const lidAnimRef = useRef<number | null>(null);
  const lastHighlightRef = useRef(false);

  useFrame(() => {
    if (highlighted && !lastHighlightRef.current) {
      lidAnimRef.current = performance.now();
    }
    lastHighlightRef.current = highlighted;

    if (!lidRef.current) return;
    if (lidAnimRef.current === null) {
      lidRef.current.rotation.x = 0;
      return;
    }
    const t = (performance.now() - lidAnimRef.current) / 520;
    if (t >= 1) {
      lidAnimRef.current = null;
      lidRef.current.rotation.x = 0;
      return;
    }
    // Open quickly to ~70° then close back — sin gives a clean open/close arc
    const openAmount = Math.sin(t * Math.PI);
    lidRef.current.rotation.x = -openAmount * 1.2;
  });

  return (
    <group>
      <Desk />
      {/* Cardboard box bottom — top is now open so the lid can flap over it */}
      <RoundedBox
        args={[1.0, 0.6, 0.78]}
        radius={0.05}
        smoothness={3}
        position={[0, 1.0, 0]}
      >
        <meshStandardMaterial color="#a87a4e" />
      </RoundedBox>
      {/* Slightly darker interior bottom so the open box reads as 3D */}
      <mesh position={[0, 1.295, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.94, 0.74]} />
        <meshStandardMaterial color="#6f4f30" />
      </mesh>

      {/* Lid — pivots around the back edge of the box top. When highlighted
          it swings open then back closed. */}
      <group ref={lidRef} position={[0, 1.3, -0.39]}>
        <RoundedBox
          args={[1.0, 0.05, 0.78]}
          radius={0.02}
          smoothness={2}
          position={[0, 0.025, 0.39]}
        >
          <meshStandardMaterial color="#a87a4e" />
        </RoundedBox>
        {/* SHIP IT label sits on top of the lid (visible when closed) */}
        <mesh position={[0, 0.052, 0.39]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.7, 0.32]} />
          <meshBasicMaterial map={labelTex} toneMapped={false} />
        </mesh>
        {/* Tape strip along the lid seam */}
        <mesh position={[0, 0.055, 0.39]}>
          <boxGeometry args={[1.02, 0.012, 0.16]} />
          <meshBasicMaterial color="#fde68a" />
        </mesh>
      </group>

      {/* Small stacked box on the side */}
      <RoundedBox
        args={[0.33, 0.33, 0.33]}
        radius={0.04}
        smoothness={3}
        position={[-0.72, 0.87, 0.2]}
      >
        <meshStandardMaterial color="#8b5e36" />
      </RoundedBox>
    </group>
  );
}

function PhotoStation({ flashing }: { flashing: boolean }) {
  // Briefly white-out the phone screen on click — sells the "flash" feel.
  const screenRef = useRef<THREE.MeshBasicMaterial>(null);
  const screenTex = useCanvasTexture(256, 384, (ctx, w, h) => {
    // Phone "viewfinder" — soft dark frame with crosshair + REC dot
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, w, h);
    // Outer frame
    ctx.fillStyle = "#1f1f1f";
    ctx.fillRect(8, 8, w - 16, h - 16);
    // Crosshair
    ctx.strokeStyle = "rgba(232,121,249,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w / 2, 30);
    ctx.lineTo(w / 2, h - 30);
    ctx.moveTo(30, h / 2);
    ctx.lineTo(w - 30, h / 2);
    ctx.stroke();
    // REC
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(28, 28, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px 'Press Start 2P', system-ui, sans-serif";
    ctx.fillText("REC", 40, 35);
  });

  useFrame(() => {
    if (!screenRef.current) return;
    // When `flashing`, push toward white; otherwise show the viewfinder.
    if (flashing) {
      screenRef.current.color.set("#ffffff");
      screenRef.current.opacity = 1;
      // Tex is preserved but the white color override blows it out.
    } else {
      screenRef.current.color.set("#ffffff");
      screenRef.current.opacity = 1;
    }
  });

  return (
    <group>
      {/* Square base plate sitting on the ground */}
      <RoundedBox
        args={[0.36, 0.05, 0.36]}
        radius={0.015}
        smoothness={2}
        position={[0, 0.025, 0]}
      >
        <meshStandardMaterial color={COLORS.glass} />
      </RoundedBox>
      {/* Single vertical pole from base up to phone mount */}
      <RoundedBox
        args={[0.07, 1.15, 0.07]}
        radius={0.02}
        smoothness={2}
        position={[0, 0.625, 0]}
      >
        <meshStandardMaterial color={COLORS.glass} />
      </RoundedBox>
      {/* Phone mount / knuckle on top of the pole */}
      <RoundedBox
        args={[0.18, 0.1, 0.18]}
        radius={0.02}
        smoothness={2}
        position={[0, 1.21, 0]}
      >
        <meshStandardMaterial color={COLORS.glass} />
      </RoundedBox>

      {/* Phone body — vertical orientation, rounded */}
      <RoundedBox
        args={[0.42, 0.78, 0.06]}
        radius={0.06}
        smoothness={4}
        position={[0, 1.6, 0.05]}
      >
        <meshStandardMaterial color={COLORS.glass} />
      </RoundedBox>
      {/* Phone screen — viewfinder or flash */}
      <mesh position={[0, 1.6, 0.085]}>
        <planeGeometry args={[0.36, 0.7]} />
        {flashing ? (
          <meshBasicMaterial
            ref={screenRef}
            color="#ffffff"
            toneMapped={false}
          />
        ) : (
          <meshBasicMaterial
            ref={screenRef}
            map={screenTex}
            toneMapped={false}
          />
        )}
      </mesh>
      {/* Camera lens cluster on the back (tiny visual) */}
      <mesh position={[0.16, 1.9, 0]}>
        <boxGeometry args={[0.05, 0.05, 0.04]} />
        <meshStandardMaterial color={COLORS.silver} />
      </mesh>

      {/* Black LV t-shirt hangs on the BACK of the phone (camera-lens side).
          Slightly higher so it peeks above the phone from the player POV.
          LV print is on both sides so both the player and the phone "see" it. */}
      <LVTShirt position={[0, 1.7, -0.7]} />

      {/* Camera flash — fires backward toward the shirt (camera-lens side).
          Bright inner sphere + wide halo so the click feels punchy. */}
      {flashing && (
        <>
          {/* Brief boost light pointed AT the shirt so it momentarily lights up */}
          <pointLight
            position={[0, 1.6, -0.2]}
            intensity={4}
            distance={2.5}
            color="#ffffff"
          />
          <mesh position={[0, 1.6, -0.3]}>
            <sphereGeometry args={[0.7, 16, 16]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
          </mesh>
          {/* Wider outer halo */}
          <mesh position={[0, 1.6, -0.25]}>
            <sphereGeometry args={[1.2, 16, 16]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
          </mesh>
        </>
      )}
    </group>
  );
}

/** Upright black t-shirt with a small white LV monogram on BOTH sides so the
 *  print is readable from any camera angle. */
function LVTShirt({ position }: { position: [number, number, number] }) {
  const lvTex = useCanvasTexture(256, 320, (ctx, w, h) => {
    // Solid black tee background
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, w, h);
    // White LV monogram — small, bold, centered on the chest
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 88px 'Press Start 2P', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("LV", w / 2, h / 2);
  });

  return (
    <group position={position}>
      {/* Hanger bar just above the shoulders */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.24, 0.02, 0.02]} />
        <meshStandardMaterial color={COLORS.silver} />
      </mesh>
      {/* Hanger hook */}
      <mesh position={[0, 0.6, 0]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.05, 0.008, 8, 16, Math.PI]} />
        <meshStandardMaterial color={COLORS.silver} />
      </mesh>

      {/* Shirt body — front face shows LV */}
      <mesh position={[0, 0, 0.012]}>
        <planeGeometry args={[0.8, 0.95]} />
        <meshBasicMaterial map={lvTex} toneMapped={false} />
      </mesh>
      {/* Shirt body — back face ALSO shows LV (rotated 180 so it reads right). */}
      <mesh position={[0, 0, -0.012]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.8, 0.95]} />
        <meshBasicMaterial map={lvTex} toneMapped={false} />
      </mesh>
      {/* Shoulders / sleeves — chunky pixel cubes off to the sides */}
      <RoundedBox
        args={[0.24, 0.2, 0.06]}
        radius={0.02}
        smoothness={2}
        position={[-0.46, 0.36, 0]}
      >
        <meshStandardMaterial color={COLORS.shirtBlack} />
      </RoundedBox>
      <RoundedBox
        args={[0.24, 0.2, 0.06]}
        radius={0.02}
        smoothness={2}
        position={[0.46, 0.36, 0]}
      >
        <meshStandardMaterial color={COLORS.shirtBlack} />
      </RoundedBox>
      {/* Collar notch */}
      <mesh position={[0, 0.47, 0.02]}>
        <boxGeometry args={[0.14, 0.04, 0.005]} />
        <meshStandardMaterial color={COLORS.shirtBlack} />
      </mesh>
    </group>
  );
}

// ---------- Character ----------

function Character({ at }: { at: StationId }) {
  const ref = useRef<THREE.Group>(null);
  const targetPos = STATION_POSITIONS[at];
  const targetRot = CHARACTER_ROTATIONS[at];
  const lerpedPos = useRef(new THREE.Vector3(targetPos[0], targetPos[1], targetPos[2] + 1.7));
  const lerpedRot = useRef(targetRot);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const tp = new THREE.Vector3(targetPos[0], targetPos[1], targetPos[2] + 1.7);
    lerpedPos.current.lerp(tp, Math.min(1, delta * 8));
    ref.current.position.copy(lerpedPos.current);
    // Shortest-arc rotation lerp
    const delta2 =
      ((((targetRot - lerpedRot.current) % (Math.PI * 2)) +
        Math.PI * 3) %
        (Math.PI * 2)) -
      Math.PI;
    lerpedRot.current += delta2 * Math.min(1, delta * 8);
    ref.current.rotation.y = lerpedRot.current;
  });

  // Pink BAPE ABC camo — soft pink base with hot-pink + red splotches to
  // match the reference image.
  const camoTex = useCanvasTexture(160, 160, (ctx, w, h) => {
    ctx.fillStyle = COLORS.bapePinkBase;
    ctx.fillRect(0, 0, w, h);
    const palette = [
      COLORS.bapePinkMid,
      COLORS.bapePinkHot,
      COLORS.bapePinkRed,
    ];
    for (let i = 0; i < 34; i++) {
      const c = palette[i % palette.length];
      const r = 9 + Math.random() * 9;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  return (
    <group ref={ref}>
      {/* Sneakers */}
      <RoundedBox args={[0.2, 0.13, 0.34]} radius={0.04} smoothness={3} position={[-0.13, 0.07, 0.06]}>
        <meshStandardMaterial color={COLORS.white} />
      </RoundedBox>
      <RoundedBox args={[0.2, 0.13, 0.34]} radius={0.04} smoothness={3} position={[0.13, 0.07, 0.06]}>
        <meshStandardMaterial color={COLORS.white} />
      </RoundedBox>
      {/* Denim legs */}
      <RoundedBox args={[0.18, 0.36, 0.18]} radius={0.05} smoothness={3} position={[-0.12, 0.28, 0]}>
        <meshStandardMaterial color={COLORS.denim} />
      </RoundedBox>
      <RoundedBox args={[0.18, 0.36, 0.18]} radius={0.05} smoothness={3} position={[0.12, 0.28, 0]}>
        <meshStandardMaterial color={COLORS.denim} />
      </RoundedBox>
      {/* Hoodie body */}
      <RoundedBox args={[0.54, 0.6, 0.34]} radius={0.08} smoothness={4} position={[0, 0.74, 0]}>
        <meshStandardMaterial map={camoTex} />
      </RoundedBox>
      {/* Arms */}
      <RoundedBox args={[0.16, 0.55, 0.2]} radius={0.06} smoothness={4} position={[-0.34, 0.74, 0]}>
        <meshStandardMaterial map={camoTex} />
      </RoundedBox>
      <RoundedBox args={[0.16, 0.55, 0.2]} radius={0.06} smoothness={4} position={[0.34, 0.74, 0]}>
        <meshStandardMaterial map={camoTex} />
      </RoundedBox>

      {/* BAPE SHARK HOODIE — fully zipped up, hood covers the entire head with
          the iconic shark face print on the front. No visible skin. */}
      <BapeSharkHood camoTex={camoTex} />

      {/* Zipper — runs all the way from chest to the very top of the hood,
          like the shirt is zipped fully closed. */}
      <mesh position={[0, 0.96, 0.176]}>
        <boxGeometry args={[0.018, 1.06, 0.005]} />
        <meshStandardMaterial
          color={COLORS.silver}
          emissive={COLORS.silver}
          emissiveIntensity={0.55}
        />
      </mesh>
      {/* Zipper pull at the top */}
      <mesh position={[0, 1.5, 0.185]}>
        <boxGeometry args={[0.045, 0.035, 0.018]} />
        <meshStandardMaterial color={COLORS.silver} emissive={COLORS.silver} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

/** Hood that fully covers the head + the BAPE shark face print drawn as a
 *  transparent canvas texture on a plane in front of the hood. */
function BapeSharkHood({ camoTex }: { camoTex: THREE.Texture }) {
  // Shark face print: two eyes high on the hood, and a big black mouth
  // outline ringed with white teeth. Transparent background so the pink
  // camo on the hood shows through everywhere else.
  const faceTex = useCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);

    // ----- Eyes (upper third) -----
    const eyeY = h * 0.32;
    const eyeR = 56;
    const eyeOffset = 95;

    function drawEye(cx: number, cy: number) {
      // Outer black outline
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.ellipse(cx, cy, eyeR + 10, eyeR + 12, 0, 0, Math.PI * 2);
      ctx.fill();
      // White eye-print body
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(cx, cy, eyeR, eyeR + 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // Pink iris hint
      ctx.fillStyle = COLORS.bapePinkHot;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 8, eyeR * 0.55, eyeR * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      // Pupil
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 8, 16, 22, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    drawEye(w / 2 - eyeOffset, eyeY);
    drawEye(w / 2 + eyeOffset, eyeY);

    // ----- Mouth: outer black shape (huge curved smile-ish) -----
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.moveTo(40, h * 0.55);
    ctx.bezierCurveTo(60, h * 0.95, w - 60, h * 0.95, w - 40, h * 0.55);
    ctx.bezierCurveTo(w - 80, h * 0.7, 80, h * 0.7, 40, h * 0.55);
    ctx.fill();

    // ----- Upper teeth (point down) -----
    ctx.fillStyle = "#ffffff";
    const upperToothCount = 11;
    const mouthLeft = 70;
    const mouthRight = w - 70;
    const upperBaseY = h * 0.6;
    for (let i = 0; i < upperToothCount; i++) {
      const t = i / (upperToothCount - 1);
      const x = mouthLeft + (mouthRight - mouthLeft) * t;
      const tipDip = Math.sin(t * Math.PI) * 18; // teeth get longer toward center
      ctx.beginPath();
      ctx.moveTo(x - 22, upperBaseY);
      ctx.lineTo(x + 22, upperBaseY);
      ctx.lineTo(x, upperBaseY + 32 + tipDip);
      ctx.closePath();
      ctx.fill();
    }

    // ----- Lower teeth (point up) -----
    const lowerToothCount = 9;
    const lowerBaseY = h * 0.92;
    const mouthLeftL = 100;
    const mouthRightL = w - 100;
    for (let i = 0; i < lowerToothCount; i++) {
      const t = i / (lowerToothCount - 1);
      const x = mouthLeftL + (mouthRightL - mouthLeftL) * t;
      const tipRise = Math.sin(t * Math.PI) * 14;
      ctx.beginPath();
      ctx.moveTo(x - 18, lowerBaseY);
      ctx.lineTo(x + 18, lowerBaseY);
      ctx.lineTo(x, lowerBaseY - 26 - tipRise);
      ctx.closePath();
      ctx.fill();
    }
  });

  return (
    <group>
      {/* Hood covers the head completely — pink camo, no visible skin. */}
      <RoundedBox
        args={[0.5, 0.5, 0.5]}
        radius={0.14}
        smoothness={4}
        position={[0, 1.2, 0]}
      >
        <meshStandardMaterial map={camoTex} />
      </RoundedBox>
      {/* Hood brim — slight forward overhang at the top, like a peak */}
      <RoundedBox
        args={[0.54, 0.08, 0.12]}
        radius={0.03}
        smoothness={3}
        position={[0, 1.42, 0.18]}
      >
        <meshStandardMaterial map={camoTex} />
      </RoundedBox>
      {/* Pointy hood tip on top */}
      <RoundedBox
        args={[0.18, 0.12, 0.18]}
        radius={0.04}
        smoothness={3}
        position={[0, 1.5, -0.06]}
      >
        <meshStandardMaterial map={camoTex} />
      </RoundedBox>

      {/* SHARK FACE PRINT — transparent canvas texture floats just in front
          of the hood so the camo shows through everywhere except the print. */}
      <mesh position={[0, 1.18, 0.252]}>
        <planeGeometry args={[0.5, 0.5]} />
        <meshBasicMaterial
          map={faceTex}
          transparent
          alphaTest={0.02}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// ---------- Task (product drops) ----------

interface TaskProps {
  task: ActiveTask;
  imageUrls: string[];
}

function Task({ task, imageUrls }: TaskProps) {
  const url = imageUrls[task.imageIndex % Math.max(1, imageUrls.length)];
  return url ? (
    <TaskWithImage task={task} url={url} />
  ) : (
    <TaskFallback task={task} />
  );
}

// Falling-drop motion bounds shared by all task variants.
const TASK_START_Y = 5.4;
const TASK_END_Y = 1.7;

// Drop dimensions — image, frame, and countdown ring sized together so the
// drops read clearly on both mobile and desktop without overlapping stations.
const TASK_IMAGE_SIZE = 1.32;
const TASK_FRAME_SIZE = 1.4;
const TASK_RING_INNER = 0.55;
const TASK_RING_OUTER = 0.72;

function TaskWithImage({ task, url }: { task: ActiveTask; url: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ringGeometry = useMemo(
    () => new THREE.RingGeometry(TASK_RING_INNER, TASK_RING_OUTER, 32),
    []
  );
  const fullDuration = task.expiresAt - task.spawnedAt;

  // Texture cached per URL so reusing the same product image across spawns
  // doesn't re-download or re-decode.
  const tex = useMemo(() => loadProductTexture(url), [url]);

  useFrame(() => {
    if (!groupRef.current || !ringRef.current) return;
    const now = performance.now();
    const remaining = Math.max(0, task.expiresAt - now);
    const lifeRatio = fullDuration > 0 ? remaining / fullDuration : 0;
    // Drop straight down from TASK_START_Y to TASK_END_Y over the task's life.
    const fall = 1 - lifeRatio;
    groupRef.current.position.y = TASK_START_Y + (TASK_END_Y - TASK_START_Y) * fall;

    ringRef.current.scale.set(lifeRatio, lifeRatio, 1);
    const mat = ringRef.current.material as THREE.MeshBasicMaterial;
    mat.color.set(lifeRatio < 0.25 ? COLORS.warning : COLORS.neonHot);
  });

  const stationPos = STATION_POSITIONS[task.stationId];

  return (
    <group ref={groupRef} position={[stationPos[0], TASK_START_Y, stationPos[2]]}>
      {/* Solid black frame — slightly larger than the image to form a clean
          black border on all sides. */}
      <mesh position={[0, 0, -0.005]}>
        <planeGeometry args={[TASK_FRAME_SIZE, TASK_FRAME_SIZE]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      {/* Flat 2D product image — no transparency, no spin. The product's
          white background blends with the scene's white background. */}
      <mesh>
        <planeGeometry args={[TASK_IMAGE_SIZE, TASK_IMAGE_SIZE]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* Countdown ring — shrinks as the drop ages */}
      <mesh ref={ringRef} position={[0, 0, 0.02]}>
        <primitive object={ringGeometry} attach="geometry" />
        <meshBasicMaterial color={COLORS.neonHot} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function TaskFallback({ task }: { task: ActiveTask }) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ringGeometry = useMemo(
    () => new THREE.RingGeometry(TASK_RING_INNER, TASK_RING_OUTER, 32),
    []
  );
  const fullDuration = task.expiresAt - task.spawnedAt;

  useFrame(() => {
    if (!groupRef.current || !ringRef.current) return;
    const now = performance.now();
    const remaining = Math.max(0, task.expiresAt - now);
    const lifeRatio = fullDuration > 0 ? remaining / fullDuration : 0;
    const fall = 1 - lifeRatio;
    groupRef.current.position.y = TASK_START_Y + (TASK_END_Y - TASK_START_Y) * fall;
    ringRef.current.scale.set(lifeRatio, lifeRatio, 1);
    const mat = ringRef.current.material as THREE.MeshBasicMaterial;
    mat.color.set(lifeRatio < 0.25 ? COLORS.warning : COLORS.neonHot);
  });

  const stationPos = STATION_POSITIONS[task.stationId];

  return (
    <group ref={groupRef} position={[stationPos[0], TASK_START_Y, stationPos[2]]}>
      {/* Black border frame */}
      <mesh position={[0, 0, -0.005]}>
        <planeGeometry args={[TASK_FRAME_SIZE, TASK_FRAME_SIZE]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh>
        <planeGeometry args={[TASK_IMAGE_SIZE, TASK_IMAGE_SIZE]} />
        <meshBasicMaterial color={COLORS.neonHot} />
      </mesh>
      <mesh ref={ringRef} position={[0, 0, 0.02]}>
        <primitive object={ringGeometry} attach="geometry" />
        <meshBasicMaterial color={COLORS.neonHot} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
