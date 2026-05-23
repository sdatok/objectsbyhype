"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

export type StationId = "computer" | "packing" | "camera";
export type BrandId = "supreme" | "bape" | "chromeHearts" | "bearBrick";

export const STATION_IDS: StationId[] = ["computer", "packing", "camera"];
export const BRAND_IDS: BrandId[] = [
  "supreme",
  "bape",
  "chromeHearts",
  "bearBrick",
];

export const STATION_LABELS: Record<StationId, string> = {
  computer: "List on eBay",
  packing: "Pack the drop",
  camera: "Shoot the fit",
};

export interface ActiveTask {
  id: string;
  stationId: StationId;
  brand: BrandId;
  spawnedAt: number;
  expiresAt: number;
}

const STATION_POSITIONS: Record<StationId, [number, number, number]> = {
  computer: [-3.4, 0, 0],
  packing: [0, 0, 0],
  camera: [3.4, 0, 0],
};

// Purple-flame palette — matches the Vercel Ship NYC aesthetic.
const COLORS = {
  bg: "#0b0214",
  floor: "#16092a",
  floorAccent: "#2a0f4f",
  base: "#1a0b2e",
  panel: "#241141",
  outline: "#c026d3",
  neonHot: "#e879f9",
  neonCool: "#7c3aed",
  white: "#ffffff",
  red: "#dc2626",
  redHot: "#ef4444",
  skin: "#f4cfa0",
  denim: "#1e293b",
  bapeGreen: "#3f6f44",
  bapeBrown: "#5a4a2e",
  chromeBlack: "#0a0a0a",
  chromeSilver: "#cbd5e1",
  bearYellow: "#fcd34d",
  bearOrange: "#fb923c",
  warning: "#fb7185",
};

interface GameSceneProps {
  tasks: ActiveTask[];
  characterAt: StationId;
  flashStation: StationId | null;
  onStationClick: (id: StationId) => void;
}

export default function GameScene(props: GameSceneProps) {
  return (
    <Canvas
      shadows={false}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false }}
      camera={{ position: [0, 4.4, 7.4], fov: 38 }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor(COLORS.bg);
        scene.background = new THREE.Color(COLORS.bg);
        scene.fog = new THREE.Fog(COLORS.bg, 9, 22);
      }}
      style={{ touchAction: "manipulation" }}
    >
      {/* Ambient + main light keeps things readable, point lights add the neon vibe. */}
      <ambientLight intensity={0.55} color="#a78bfa" />
      <directionalLight position={[6, 8, 5]} intensity={0.9} color="#ffffff" />
      <pointLight position={[-5, 3, 3]} intensity={1.4} color={COLORS.neonHot} distance={12} />
      <pointLight position={[5, 3, 3]} intensity={1.2} color={COLORS.neonCool} distance={12} />
      <pointLight position={[0, 1.5, 4]} intensity={0.6} color={COLORS.outline} distance={8} />

      <Floor />
      <BackFlames />

      {STATION_IDS.map((id) => (
        <Workstation
          key={id}
          stationId={id}
          position={STATION_POSITIONS[id]}
          highlighted={props.flashStation === id}
          onClick={() => props.onStationClick(id)}
        />
      ))}

      <Character position={STATION_POSITIONS[props.characterAt]} />

      {props.tasks.map((task) => (
        <Task key={task.id} task={task} />
      ))}
    </Canvas>
  );
}

function Floor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[40, 16]} />
        <meshStandardMaterial color={COLORS.floor} />
      </mesh>
      {/* Neon strips on the floor in front of the camera — pure decoration. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 2.1]}>
        <planeGeometry args={[12, 0.06]} />
        <meshBasicMaterial color={COLORS.neonHot} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 2.5]}>
        <planeGeometry args={[12, 0.04]} />
        <meshBasicMaterial color={COLORS.neonCool} />
      </mesh>
    </group>
  );
}

/** Crude low-poly purple flames flanking the scene — pure vibe. */
function BackFlames() {
  const tips: [number, number, number][] = [
    [-5.4, 0, -1.8],
    [-4.6, 0, -1.8],
    [-3.8, 0, -1.8],
    [3.8, 0, -1.8],
    [4.6, 0, -1.8],
    [5.4, 0, -1.8],
  ];
  return (
    <group>
      {tips.map((p, i) => (
        <Flame key={i} position={p} hue={i % 2 === 0 ? COLORS.neonHot : COLORS.neonCool} />
      ))}
    </group>
  );
}

function Flame({
  position,
  hue,
}: {
  position: [number, number, number];
  hue: string;
}) {
  const inner = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!inner.current) return;
    const t = state.clock.elapsedTime;
    // Subtle flicker — scale Y a bit and modulate intensity.
    const flick = 1 + Math.sin(t * 6 + position[0]) * 0.08;
    inner.current.scale.set(1, flick, 1);
  });
  return (
    <group position={position}>
      {/* Outer halo */}
      <mesh position={[0, 0.55, 0]}>
        <coneGeometry args={[0.45, 1.4, 12]} />
        <meshBasicMaterial color={hue} transparent opacity={0.35} />
      </mesh>
      {/* Bright core */}
      <mesh ref={inner} position={[0, 0.45, 0]}>
        <coneGeometry args={[0.22, 1.1, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

interface WorkstationProps {
  stationId: StationId;
  position: [number, number, number];
  highlighted: boolean;
  onClick: () => void;
}

function Workstation({
  stationId,
  position,
  highlighted,
  onClick,
}: WorkstationProps) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const target = highlighted ? 1.1 : 1;
    const current = groupRef.current.scale.x;
    const next = current + (target - current) * Math.min(1, delta * 10);
    groupRef.current.scale.setScalar(next);
  });

  return (
    <group ref={groupRef} position={position} onClick={onClick}>
      {/* Big invisible hit target so taps are forgiving on mobile. */}
      <mesh position={[0, 1.2, 0]} visible={false}>
        <boxGeometry args={[2.8, 2.8, 2.8]} />
        <meshBasicMaterial />
      </mesh>

      {/* Neon halo ring under each station — pulses when highlighted */}
      <StationGlow active={highlighted} />

      {stationId === "computer" && <ComputerStation />}
      {stationId === "packing" && <PackingStation />}
      {stationId === "camera" && <CameraStation />}
    </group>
  );
}

function StationGlow({ active }: { active: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const pulse = active
      ? 0.55 + Math.sin(t * 10) * 0.25
      : 0.18 + Math.sin(t * 2) * 0.05;
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = pulse;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
      <ringGeometry args={[1.1, 1.55, 32]} />
      <meshBasicMaterial color={COLORS.neonHot} transparent opacity={0.18} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Desk() {
  return (
    <group>
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[2.2, 0.1, 1.2]} />
        <meshStandardMaterial color={COLORS.base} />
      </mesh>
      {/* Glowing front edge */}
      <mesh position={[0, 0.7, 0.605]}>
        <boxGeometry args={[2.2, 0.04, 0.02]} />
        <meshBasicMaterial color={COLORS.outline} />
      </mesh>
      {[
        [-0.95, 0.35, 0.5],
        [0.95, 0.35, 0.5],
        [-0.95, 0.35, -0.5],
        [0.95, 0.35, -0.5],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <boxGeometry args={[0.1, 0.7, 0.1]} />
          <meshStandardMaterial color={COLORS.base} />
        </mesh>
      ))}
    </group>
  );
}

/** Build a canvas texture once and memoize it. SSR-safe because GameScene is
 *  loaded with ssr: false from HomeGame. */
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

function ComputerStation() {
  // Internet-money screen: dollar signs + bold INTERNET MONEY text on a dark
  // purple background so it pops against the monitor frame.
  const screenTexture = useCanvasTexture(512, 320, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#1a0633");
    grad.addColorStop(1, "#3b0a6b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Big $ row
    ctx.fillStyle = "#86efac";
    ctx.font = "bold 130px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$ $ $", w / 2, h / 2 - 50);

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 64px 'Inter', system-ui, sans-serif";
    ctx.fillText("INTERNET", w / 2, h / 2 + 55);
    ctx.fillStyle = "#e879f9";
    ctx.fillText("MONEY", w / 2, h / 2 + 115);
  });

  return (
    <group>
      <Desk />
      {/* Monitor bezel */}
      <mesh position={[0, 1.35, -0.05]}>
        <boxGeometry args={[1.2, 0.78, 0.08]} />
        <meshStandardMaterial color={COLORS.chromeBlack} />
      </mesh>
      {/* Glowing screen */}
      <mesh position={[0, 1.35, 0.0]}>
        <boxGeometry args={[1.04, 0.62, 0.02]} />
        <meshBasicMaterial map={screenTexture} toneMapped={false} />
      </mesh>
      {/* Stand */}
      <mesh position={[0, 0.95, -0.1]}>
        <boxGeometry args={[0.18, 0.3, 0.1]} />
        <meshStandardMaterial color={COLORS.chromeBlack} />
      </mesh>
      {/* Keyboard with neon strip */}
      <mesh position={[0, 0.78, 0.3]}>
        <boxGeometry args={[0.9, 0.04, 0.3]} />
        <meshStandardMaterial color={COLORS.panel} />
      </mesh>
      <mesh position={[0, 0.8, 0.3]}>
        <boxGeometry args={[0.88, 0.005, 0.02]} />
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
    ctx.font = "900 48px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SHIP IT", w / 2, h / 2 - 18);
    ctx.fillStyle = "#c026d3";
    ctx.font = "bold 22px 'Inter', system-ui, sans-serif";
    ctx.fillText("OBJECTS BY HYPE", w / 2, h / 2 + 28);
  });

  return (
    <group>
      <Desk />
      {/* Cardboard box body */}
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[0.95, 0.65, 0.75]} />
        <meshStandardMaterial color="#7a5a3a" />
      </mesh>
      {/* SHIP IT label on front of box */}
      <mesh position={[0, 1.05, 0.376]}>
        <planeGeometry args={[0.7, 0.35]} />
        <meshBasicMaterial map={labelTex} toneMapped={false} />
      </mesh>
      {/* Tape strip */}
      <mesh position={[0, 1.33, 0]}>
        <boxGeometry args={[0.97, 0.025, 0.18]} />
        <meshBasicMaterial color="#fde68a" />
      </mesh>
      {/* Small stacked box */}
      <mesh position={[-0.7, 0.86, 0.2]}>
        <boxGeometry args={[0.32, 0.32, 0.32]} />
        <meshStandardMaterial color="#6b4a2a" />
      </mesh>
    </group>
  );
}

function CameraStation() {
  return (
    <group>
      {/* Tripod legs */}
      {[
        [-0.4, 0.55, 0.4],
        [0.4, 0.55, 0.4],
        [0, 0.55, -0.5],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <boxGeometry args={[0.06, 1.1, 0.06]} />
          <meshStandardMaterial color={COLORS.chromeBlack} />
        </mesh>
      ))}
      {/* Camera body */}
      <mesh position={[0, 1.25, 0]}>
        <boxGeometry args={[0.72, 0.46, 0.5]} />
        <meshStandardMaterial color={COLORS.chromeBlack} />
      </mesh>
      {/* Lens */}
      <mesh position={[0, 1.25, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.26, 24]} />
        <meshStandardMaterial color={COLORS.panel} />
      </mesh>
      {/* REC light */}
      <mesh position={[0.25, 1.42, 0.2]}>
        <boxGeometry args={[0.05, 0.05, 0.05]} />
        <meshBasicMaterial color={COLORS.redHot} />
      </mesh>
      {/* Product being photographed */}
      <mesh position={[0, 0.22, 1.25]}>
        <boxGeometry args={[0.6, 0.42, 0.6]} />
        <meshStandardMaterial color={COLORS.neonHot} emissive={COLORS.neonCool} emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function Character({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  const lerpedPosRef = useRef(new THREE.Vector3(...position));

  useFrame((_, delta) => {
    if (!ref.current) return;
    const target = new THREE.Vector3(position[0], position[1], position[2] + 1.7);
    lerpedPosRef.current.lerp(target, Math.min(1, delta * 8));
    ref.current.position.copy(lerpedPosRef.current);
  });

  // BAPE camo texture for the hoodie — green/brown irregular blobs.
  const camoTex = useCanvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = COLORS.bapeGreen;
    ctx.fillRect(0, 0, w, h);
    const blobs = [
      { c: "#6e8f43", r: 14 },
      { c: COLORS.bapeBrown, r: 11 },
      { c: "#3a5b30", r: 13 },
    ];
    for (const b of blobs) {
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = b.c;
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

  // Supreme box logo for the cap front.
  const capTex = useCanvasTexture(256, 96, (ctx, w, h) => {
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = COLORS.white;
    ctx.font = "italic 900 56px 'Times New Roman', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Supreme", w / 2, h / 2 + 4);
  });

  return (
    <group ref={ref}>
      {/* Sneakers (Air-Force-ish white) */}
      <mesh position={[-0.13, 0.06, 0.06]}>
        <boxGeometry args={[0.18, 0.12, 0.32]} />
        <meshStandardMaterial color={COLORS.white} />
      </mesh>
      <mesh position={[0.13, 0.06, 0.06]}>
        <boxGeometry args={[0.18, 0.12, 0.32]} />
        <meshStandardMaterial color={COLORS.white} />
      </mesh>
      {/* Denim legs */}
      <mesh position={[-0.12, 0.27, 0]}>
        <boxGeometry args={[0.16, 0.34, 0.16]} />
        <meshStandardMaterial color={COLORS.denim} />
      </mesh>
      <mesh position={[0.12, 0.27, 0]}>
        <boxGeometry args={[0.16, 0.34, 0.16]} />
        <meshStandardMaterial color={COLORS.denim} />
      </mesh>
      {/* BAPE camo hoodie body */}
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[0.5, 0.55, 0.32]} />
        <meshStandardMaterial map={camoTex} />
      </mesh>
      {/* Arms */}
      <mesh position={[-0.32, 0.7, 0]}>
        <boxGeometry args={[0.13, 0.55, 0.18]} />
        <meshStandardMaterial map={camoTex} />
      </mesh>
      <mesh position={[0.32, 0.7, 0]}>
        <boxGeometry args={[0.13, 0.55, 0.18]} />
        <meshStandardMaterial map={camoTex} />
      </mesh>
      {/* Chrome Hearts silver chain — thin emissive bar across the chest */}
      <mesh position={[0, 0.85, 0.17]}>
        <boxGeometry args={[0.28, 0.04, 0.02]} />
        <meshStandardMaterial color={COLORS.chromeSilver} emissive={COLORS.chromeSilver} emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0.78, 0.18]}>
        <boxGeometry args={[0.05, 0.08, 0.02]} />
        <meshStandardMaterial color={COLORS.chromeSilver} emissive={COLORS.chromeSilver} emissiveIntensity={0.8} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.13, 0]}>
        <boxGeometry args={[0.32, 0.32, 0.32]} />
        <meshStandardMaterial color={COLORS.skin} />
      </mesh>
      {/* Supreme cap — red brim + crown with logo */}
      <mesh position={[0, 1.32, 0]}>
        <boxGeometry args={[0.36, 0.13, 0.32]} />
        <meshStandardMaterial color={COLORS.red} />
      </mesh>
      <mesh position={[0, 1.27, 0.21]}>
        <boxGeometry args={[0.36, 0.03, 0.12]} />
        <meshStandardMaterial color={COLORS.red} />
      </mesh>
      {/* Supreme logo plate on the cap front */}
      <mesh position={[0, 1.33, 0.165]}>
        <planeGeometry args={[0.28, 0.1]} />
        <meshBasicMaterial map={capTex} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ---------- Brand-themed task icons ----------

function useSupremeTex() {
  return useCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = COLORS.white;
    ctx.font = "italic 900 86px 'Times New Roman', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Supreme", w / 2, h / 2 + 6);
  });
}

function useBapeTex() {
  return useCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = COLORS.bapeGreen;
    ctx.fillRect(0, 0, w, h);
    const blobs = [
      { c: "#6e8f43", r: 26 },
      { c: COLORS.bapeBrown, r: 22 },
      { c: "#3a5b30", r: 24 },
    ];
    for (const b of blobs) {
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = b.c;
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

function useChromeHeartsTex() {
  return useCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = COLORS.chromeBlack;
    ctx.fillRect(0, 0, w, h);
    // Plus / cross icon in silver — evokes the Chrome Hearts cross.
    ctx.fillStyle = COLORS.chromeSilver;
    const cx = w / 2;
    const cy = h / 2;
    const arm = 90;
    const thick = 36;
    ctx.fillRect(cx - thick / 2, cy - arm, thick, arm * 2);
    ctx.fillRect(cx - arm, cy - thick / 2, arm * 2, thick);
    // Flared tips
    ctx.fillRect(cx - thick, cy - arm - 12, thick * 2, 12);
    ctx.fillRect(cx - thick, cy + arm, thick * 2, 12);
    ctx.fillRect(cx - arm - 12, cy - thick, 12, thick * 2);
    ctx.fillRect(cx + arm, cy - thick, 12, thick * 2);
  });
}

function useBearBrickTex() {
  return useCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = COLORS.bearYellow;
    ctx.fillRect(0, 0, w, h);
    // Two eye dots + a smile to read as "bear" head.
    ctx.fillStyle = COLORS.chromeBlack;
    ctx.beginPath();
    ctx.arc(w * 0.34, h * 0.42, 24, 0, Math.PI * 2);
    ctx.arc(w * 0.66, h * 0.42, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.7, 14, 0, Math.PI * 2);
    ctx.fill();
    // Brand stripe at the top — orange "BE@RBRICK" vibe.
    ctx.fillStyle = COLORS.bearOrange;
    ctx.fillRect(0, 0, w, 36);
  });
}

function Task({ task }: { task: ActiveTask }) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ringGeometry = useMemo(() => new THREE.RingGeometry(0.34, 0.46, 32), []);
  const fullDuration = task.expiresAt - task.spawnedAt;

  const supremeTex = useSupremeTex();
  const bapeTex = useBapeTex();
  const chromeTex = useChromeHeartsTex();
  const bearTex = useBearBrickTex();
  const texture =
    task.brand === "supreme"
      ? supremeTex
      : task.brand === "bape"
        ? bapeTex
        : task.brand === "chromeHearts"
          ? chromeTex
          : bearTex;

  const accentColor =
    task.brand === "supreme"
      ? COLORS.red
      : task.brand === "bape"
        ? COLORS.bapeGreen
        : task.brand === "chromeHearts"
          ? COLORS.chromeSilver
          : COLORS.bearYellow;

  useFrame((state) => {
    if (!groupRef.current || !ringRef.current) return;
    const now = performance.now();
    const remaining = Math.max(0, task.expiresAt - now);
    const ratio = fullDuration > 0 ? remaining / fullDuration : 0;
    groupRef.current.position.y =
      2.3 + Math.sin(state.clock.elapsedTime * 4 + task.spawnedAt) * 0.08;
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.6;

    ringRef.current.scale.set(ratio, ratio, 1);
    const mat = ringRef.current.material as THREE.MeshBasicMaterial;
    mat.color.set(ratio < 0.25 ? COLORS.warning : accentColor);
  });

  const stationPos = STATION_POSITIONS[task.stationId];

  return (
    <group ref={groupRef} position={[stationPos[0], 2.3, stationPos[2]]}>
      {/* Brand box */}
      <mesh>
        <boxGeometry args={[0.55, 0.55, 0.55]} />
        <meshStandardMaterial
          map={texture}
          emissive={accentColor}
          emissiveIntensity={0.45}
          toneMapped={false}
        />
      </mesh>
      {/* Timer ring */}
      <mesh ref={ringRef} position={[0, 0, 0.34]}>
        <primitive object={ringGeometry} attach="geometry" />
        <meshBasicMaterial color={accentColor} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
