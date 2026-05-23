"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
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
  skin: "#f5d2a8",
  denim: "#1e293b",
  bapeGreen: "#3f6f44",
  bapeBrown: "#6b5028",
  bapeDark: "#2d4a26",
  bapeLight: "#7a9c4e",
  silver: "#cbd5e1",
  glass: "#0f172a",
  shirt: "#e879f9",
  warning: "#fb7185",
};

interface GameSceneProps {
  tasks: ActiveTask[];
  characterAt: StationId;
  flashStation: StationId | null;
  cameraFlash: boolean;
  productImageUrls: string[];
  onStationClick: (id: StationId) => void;
}

export default function GameScene(props: GameSceneProps) {
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
      style={{ touchAction: "manipulation" }}
      frameloop="always"
    >
      <ResponsiveCamera />

      {/* Bright studio-style lighting now that the bg is white. One ambient +
          one directional is plenty — saved a couple shader passes for mobile. */}
      <ambientLight intensity={1.05} />
      <directionalLight position={[5, 8, 5]} intensity={0.65} />

      <Floor />
      <BackFlames />

      {STATION_IDS.map((id) => (
        <Workstation
          key={id}
          stationId={id}
          position={STATION_POSITIONS[id]}
          highlighted={props.flashStation === id}
          cameraFlash={id === "camera" && props.cameraFlash}
          onClick={() => props.onStationClick(id)}
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
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[40, 16]} />
        <meshStandardMaterial color={COLORS.floor} />
      </mesh>
      {/* Subtle accent stripes on the floor — soft purple band running across */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 2.1]}>
        <planeGeometry args={[12, 0.08]} />
        <meshBasicMaterial color={COLORS.neonHot} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 2.6]}>
        <planeGeometry args={[12, 0.05]} />
        <meshBasicMaterial color={COLORS.neonCool} />
      </mesh>
    </group>
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
  onClick: () => void;
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

      {stationId === "computer" && <ComputerStation />}
      {stationId === "packing" && <PackingStation />}
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

function useCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
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

function ComputerStation() {
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
    </group>
  );
}

function PackingStation() {
  const labelTex = useCanvasTexture(256, 160, (ctx, w, h) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#0b0214";
    ctx.font = "900 38px 'Press Start 2P', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SHIP IT", w / 2, h / 2 - 10);
    ctx.fillStyle = "#c026d3";
    ctx.font = "bold 18px 'Press Start 2P', system-ui, sans-serif";
    ctx.fillText("OBH", w / 2, h / 2 + 36);
  });

  return (
    <group>
      <Desk />
      {/* Cardboard box body — rounded for that cleaner look */}
      <RoundedBox args={[1.0, 0.7, 0.78]} radius={0.05} smoothness={3} position={[0, 1.05, 0]}>
        <meshStandardMaterial color="#a87a4e" />
      </RoundedBox>
      {/* SHIP IT label */}
      <mesh position={[0, 1.1, 0.39]}>
        <planeGeometry args={[0.74, 0.36]} />
        <meshBasicMaterial map={labelTex} toneMapped={false} />
      </mesh>
      {/* Tape strip */}
      <mesh position={[0, 1.41, 0]}>
        <boxGeometry args={[1.02, 0.025, 0.18]} />
        <meshBasicMaterial color="#fde68a" />
      </mesh>
      {/* Small stacked box on the side */}
      <RoundedBox args={[0.33, 0.33, 0.33]} radius={0.04} smoothness={3} position={[-0.72, 0.87, 0.2]}>
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
      {/* Tripod legs */}
      {([
        [-0.35, 0.55, 0.4],
        [0.35, 0.55, 0.4],
        [0, 0.55, -0.5],
      ] as [number, number, number][]).map((p, i) => (
        <RoundedBox
          key={i}
          args={[0.07, 1.1, 0.07]}
          radius={0.02}
          smoothness={2}
          position={p}
        >
          <meshStandardMaterial color={COLORS.glass} />
        </RoundedBox>
      ))}
      {/* Tripod head / mount */}
      <RoundedBox args={[0.18, 0.1, 0.18]} radius={0.02} smoothness={2} position={[0, 1.15, 0]}>
        <meshStandardMaterial color={COLORS.glass} />
      </RoundedBox>

      {/* Phone body — vertical orientation, rounded */}
      <RoundedBox
        args={[0.42, 0.78, 0.06]}
        radius={0.06}
        smoothness={4}
        position={[0, 1.55, 0.05]}
        rotation={[0, 0, 0]}
      >
        <meshStandardMaterial color={COLORS.glass} />
      </RoundedBox>
      {/* Phone screen — viewfinder or flash */}
      <mesh position={[0, 1.55, 0.085]}>
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
      <mesh position={[0.16, 1.85, 0.0]}>
        <boxGeometry args={[0.05, 0.05, 0.04]} />
        <meshStandardMaterial color={COLORS.silver} />
      </mesh>

      {/* Clothing piece being photographed — a folded t-shirt */}
      <TShirt position={[0, 0.05, 1.4]} />

      {/* Bright flash burst — invisible by default, visible while flashing */}
      {flashing && (
        <mesh position={[0, 1.55, 0.15]}>
          <sphereGeometry args={[0.55, 16, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
}

function TShirt({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Body of folded shirt */}
      <RoundedBox args={[0.7, 0.16, 0.55]} radius={0.04} smoothness={3} position={[0, 0.1, 0]}>
        <meshStandardMaterial color={COLORS.shirt} />
      </RoundedBox>
      {/* Collar strip */}
      <mesh position={[0, 0.19, -0.18]}>
        <boxGeometry args={[0.28, 0.02, 0.12]} />
        <meshStandardMaterial color={COLORS.white} />
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

  // BAPE camo texture used on the body + sleeves + hood.
  const camoTex = useCanvasTexture(160, 160, (ctx, w, h) => {
    ctx.fillStyle = COLORS.bapeGreen;
    ctx.fillRect(0, 0, w, h);
    const palette = [COLORS.bapeLight, COLORS.bapeDark, COLORS.bapeBrown];
    for (let i = 0; i < 28; i++) {
      const c = palette[i % palette.length];
      const r = 10 + Math.random() * 8;
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
      {/* Hoodie body (rounded) */}
      <RoundedBox args={[0.54, 0.6, 0.34]} radius={0.08} smoothness={4} position={[0, 0.74, 0]}>
        <meshStandardMaterial map={camoTex} />
      </RoundedBox>
      {/* Front zipper line */}
      <mesh position={[0, 0.74, 0.175]}>
        <boxGeometry args={[0.015, 0.55, 0.005]} />
        <meshStandardMaterial color={COLORS.silver} emissive={COLORS.silver} emissiveIntensity={0.6} />
      </mesh>
      {/* Arms */}
      <RoundedBox args={[0.16, 0.55, 0.2]} radius={0.06} smoothness={4} position={[-0.34, 0.74, 0]}>
        <meshStandardMaterial map={camoTex} />
      </RoundedBox>
      <RoundedBox args={[0.16, 0.55, 0.2]} radius={0.06} smoothness={4} position={[0.34, 0.74, 0]}>
        <meshStandardMaterial map={camoTex} />
      </RoundedBox>
      {/* Chrome Hearts–style silver chain */}
      <mesh position={[0, 0.92, 0.18]}>
        <boxGeometry args={[0.3, 0.04, 0.02]} />
        <meshStandardMaterial color={COLORS.silver} emissive={COLORS.silver} emissiveIntensity={0.5} />
      </mesh>

      {/* Head (rounded, more spherical) */}
      <mesh position={[0, 1.18, 0]}>
        <sphereGeometry args={[0.2, 16, 12]} />
        <meshStandardMaterial color={COLORS.skin} />
      </mesh>

      {/* BAPE SHARK HOODIE — hood pulled up over the head, with teeth on the front. */}
      <BapeSharkHood camoTex={camoTex} />
    </group>
  );
}

/** Hood + zipper + shark teeth + eyes. Built as small rounded boxes so it
 *  reads as a pixel/voxel shark hoodie up close. */
function BapeSharkHood({ camoTex }: { camoTex: THREE.Texture }) {
  return (
    <group>
      {/* Outer hood — wraps the head */}
      <RoundedBox args={[0.46, 0.42, 0.46]} radius={0.12} smoothness={4} position={[0, 1.2, -0.02]}>
        <meshStandardMaterial map={camoTex} />
      </RoundedBox>
      {/* Hood brim — slight forward overhang */}
      <RoundedBox args={[0.5, 0.06, 0.12]} radius={0.03} smoothness={3} position={[0, 1.39, 0.18]}>
        <meshStandardMaterial map={camoTex} />
      </RoundedBox>

      {/* Two eyes (the hoodie's eye prints) */}
      <mesh position={[-0.08, 1.27, 0.21]}>
        <boxGeometry args={[0.06, 0.06, 0.02]} />
        <meshBasicMaterial color={COLORS.white} toneMapped={false} />
      </mesh>
      <mesh position={[0.08, 1.27, 0.21]}>
        <boxGeometry args={[0.06, 0.06, 0.02]} />
        <meshBasicMaterial color={COLORS.white} toneMapped={false} />
      </mesh>
      <mesh position={[-0.08, 1.27, 0.22]}>
        <boxGeometry args={[0.025, 0.025, 0.02]} />
        <meshBasicMaterial color={COLORS.glass} toneMapped={false} />
      </mesh>
      <mesh position={[0.08, 1.27, 0.22]}>
        <boxGeometry args={[0.025, 0.025, 0.02]} />
        <meshBasicMaterial color={COLORS.glass} toneMapped={false} />
      </mesh>

      {/* Mouth area — a darker camo block to look like the zipped half */}
      <RoundedBox args={[0.34, 0.14, 0.16]} radius={0.03} smoothness={3} position={[0, 1.13, 0.18]}>
        <meshStandardMaterial color={COLORS.bapeDark} />
      </RoundedBox>

      {/* Shark teeth — small white triangular-ish cubes along the mouth */}
      {[-0.13, -0.07, -0.01, 0.05, 0.11].map((x, i) => (
        <mesh key={i} position={[x, 1.16, 0.245]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.025, 0.05, 4]} />
          <meshBasicMaterial color={COLORS.white} toneMapped={false} />
        </mesh>
      ))}
      {/* Lower teeth */}
      {[-0.1, -0.04, 0.02, 0.08].map((x, i) => (
        <mesh key={`l${i}`} position={[x, 1.09, 0.245]}>
          <coneGeometry args={[0.022, 0.045, 4]} />
          <meshBasicMaterial color={COLORS.white} toneMapped={false} />
        </mesh>
      ))}
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

function TaskWithImage({ task, url }: { task: ActiveTask; url: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ringGeometry = useMemo(
    () => new THREE.RingGeometry(0.38, 0.5, 32),
    []
  );
  const fullDuration = task.expiresAt - task.spawnedAt;

  // Texture is cached per URL so reusing the same product image across many
  // task spawns doesn't re-download or re-decode.
  const tex = useMemo(() => loadProductTexture(url), [url]);

  useFrame((state) => {
    if (!groupRef.current || !ringRef.current) return;
    const now = performance.now();
    const remaining = Math.max(0, task.expiresAt - now);
    const ratio = fullDuration > 0 ? remaining / fullDuration : 0;
    groupRef.current.position.y =
      2.4 + Math.sin(state.clock.elapsedTime * 4 + task.spawnedAt) * 0.07;
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.5;

    ringRef.current.scale.set(ratio, ratio, 1);
    const mat = ringRef.current.material as THREE.MeshBasicMaterial;
    mat.color.set(ratio < 0.25 ? COLORS.warning : COLORS.neonHot);
  });

  const stationPos = STATION_POSITIONS[task.stationId];

  return (
    <group ref={groupRef} position={[stationPos[0], 2.4, stationPos[2]]}>
      <RoundedBox args={[0.65, 0.65, 0.65]} radius={0.06} smoothness={3}>
        <meshStandardMaterial
          map={tex}
          emissive="#ffffff"
          emissiveMap={tex}
          emissiveIntensity={0.18}
          toneMapped={false}
        />
      </RoundedBox>
      <mesh ref={ringRef} position={[0, 0, 0.36]}>
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
    () => new THREE.RingGeometry(0.38, 0.5, 32),
    []
  );
  const fullDuration = task.expiresAt - task.spawnedAt;

  useFrame((state) => {
    if (!groupRef.current || !ringRef.current) return;
    const now = performance.now();
    const remaining = Math.max(0, task.expiresAt - now);
    const ratio = fullDuration > 0 ? remaining / fullDuration : 0;
    groupRef.current.position.y =
      2.4 + Math.sin(state.clock.elapsedTime * 4 + task.spawnedAt) * 0.07;
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    ringRef.current.scale.set(ratio, ratio, 1);
    const mat = ringRef.current.material as THREE.MeshBasicMaterial;
    mat.color.set(ratio < 0.25 ? COLORS.warning : COLORS.neonHot);
  });

  const stationPos = STATION_POSITIONS[task.stationId];

  return (
    <group ref={groupRef} position={[stationPos[0], 2.4, stationPos[2]]}>
      <RoundedBox args={[0.6, 0.6, 0.6]} radius={0.06} smoothness={3}>
        <meshStandardMaterial color={COLORS.neonHot} />
      </RoundedBox>
      <mesh ref={ringRef} position={[0, 0, 0.34]}>
        <primitive object={ringGeometry} attach="geometry" />
        <meshBasicMaterial color={COLORS.neonHot} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
