"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

export interface ActiveTask {
  id: string;
  stationId: StationId;
  spawnedAt: number;
  expiresAt: number;
}

export type StationId = "computer" | "packing" | "camera";

export const STATION_IDS: StationId[] = ["computer", "packing", "camera"];

export const STATION_LABELS: Record<StationId, string> = {
  computer: "List on eBay",
  packing: "Pack order",
  camera: "Shoot product",
};

const STATION_POSITIONS: Record<StationId, [number, number, number]> = {
  computer: [-3.4, 0, 0],
  packing: [0, 0, 0],
  camera: [3.4, 0, 0],
};

// Black + white + a single neutral accent — keep the palette "clean and aesthetic".
const COLORS = {
  floor: "#fafafa",
  base: "#111111",
  panel: "#1e1e1e",
  highlight: "#ffffff",
  taskRing: "#000000",
  taskFill: "#111111",
  warning: "#dc2626",
};

interface GameSceneProps {
  /** Tasks currently visible above stations. */
  tasks: ActiveTask[];
  /** Station the character is currently standing at. */
  characterAt: StationId;
  /** Briefly-highlighted station (e.g. just-completed) for feedback. */
  flashStation: StationId | null;
  /** Click handler — game logic decides whether it scores. */
  onStationClick: (id: StationId) => void;
}

/** SSR-safe wrapper. R3F's Canvas requires window. */
export default function GameScene(props: GameSceneProps) {
  return (
    <Canvas
      shadows={false}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false }}
      camera={{ position: [0, 4.4, 7.2], fov: 38 }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor("#ffffff");
        scene.background = new THREE.Color("#ffffff");
      }}
      style={{ touchAction: "manipulation" }}
    >
      <ambientLight intensity={0.85} />
      <directionalLight position={[6, 8, 5]} intensity={0.9} />

      <Floor />

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
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <planeGeometry args={[40, 16]} />
      <meshStandardMaterial color={COLORS.floor} />
    </mesh>
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

  // Subtle hover-style scale when highlighted; pure r3f tween.
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const target = highlighted ? 1.08 : 1;
    const current = groupRef.current.scale.x;
    const next = current + (target - current) * Math.min(1, delta * 10);
    groupRef.current.scale.setScalar(next);
  });

  return (
    <group ref={groupRef} position={position} onClick={onClick}>
      {/* Generous invisible hit target so taps on mobile are easy. */}
      <mesh position={[0, 1.2, 0]} visible={false}>
        <boxGeometry args={[2.6, 2.6, 2.6]} />
        <meshBasicMaterial />
      </mesh>

      {stationId === "computer" && <ComputerStation />}
      {stationId === "packing" && <PackingStation />}
      {stationId === "camera" && <CameraStation />}
    </group>
  );
}

function Desk() {
  return (
    <group>
      {/* Tabletop */}
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[2.2, 0.1, 1.2]} />
        <meshStandardMaterial color={COLORS.base} />
      </mesh>
      {/* Front legs */}
      <mesh position={[-0.95, 0.35, 0.5]}>
        <boxGeometry args={[0.1, 0.7, 0.1]} />
        <meshStandardMaterial color={COLORS.base} />
      </mesh>
      <mesh position={[0.95, 0.35, 0.5]}>
        <boxGeometry args={[0.1, 0.7, 0.1]} />
        <meshStandardMaterial color={COLORS.base} />
      </mesh>
      {/* Back legs */}
      <mesh position={[-0.95, 0.35, -0.5]}>
        <boxGeometry args={[0.1, 0.7, 0.1]} />
        <meshStandardMaterial color={COLORS.base} />
      </mesh>
      <mesh position={[0.95, 0.35, -0.5]}>
        <boxGeometry args={[0.1, 0.7, 0.1]} />
        <meshStandardMaterial color={COLORS.base} />
      </mesh>
    </group>
  );
}

function ComputerStation() {
  return (
    <group>
      <Desk />
      {/* Monitor */}
      <mesh position={[0, 1.35, -0.05]}>
        <boxGeometry args={[1.1, 0.7, 0.08]} />
        <meshStandardMaterial color={COLORS.panel} />
      </mesh>
      {/* Monitor screen highlight */}
      <mesh position={[0, 1.35, 0.0]}>
        <boxGeometry args={[1.0, 0.6, 0.02]} />
        <meshStandardMaterial color={COLORS.highlight} />
      </mesh>
      {/* Stand */}
      <mesh position={[0, 0.95, -0.1]}>
        <boxGeometry args={[0.18, 0.3, 0.1]} />
        <meshStandardMaterial color={COLORS.panel} />
      </mesh>
      {/* Keyboard */}
      <mesh position={[0, 0.78, 0.3]}>
        <boxGeometry args={[0.9, 0.04, 0.3]} />
        <meshStandardMaterial color={COLORS.panel} />
      </mesh>
    </group>
  );
}

function PackingStation() {
  return (
    <group>
      <Desk />
      {/* Cardboard box */}
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[0.9, 0.6, 0.7]} />
        <meshStandardMaterial color={COLORS.panel} />
      </mesh>
      {/* Tape strip */}
      <mesh position={[0, 1.31, 0]}>
        <boxGeometry args={[0.92, 0.02, 0.15]} />
        <meshStandardMaterial color={COLORS.highlight} />
      </mesh>
      {/* Small stacked box */}
      <mesh position={[-0.7, 0.85, 0.2]}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color={COLORS.panel} />
      </mesh>
    </group>
  );
}

function CameraStation() {
  return (
    <group>
      {/* Tripod base */}
      <mesh position={[-0.4, 0.05, 0.4]}>
        <boxGeometry args={[0.06, 1.1, 0.06]} />
        <meshStandardMaterial color={COLORS.base} />
      </mesh>
      <mesh position={[0.4, 0.05, 0.4]}>
        <boxGeometry args={[0.06, 1.1, 0.06]} />
        <meshStandardMaterial color={COLORS.base} />
      </mesh>
      <mesh position={[0, 0.05, -0.5]}>
        <boxGeometry args={[0.06, 1.1, 0.06]} />
        <meshStandardMaterial color={COLORS.base} />
      </mesh>
      {/* Camera body */}
      <mesh position={[0, 1.25, 0]}>
        <boxGeometry args={[0.7, 0.45, 0.5]} />
        <meshStandardMaterial color={COLORS.base} />
      </mesh>
      {/* Lens */}
      <mesh position={[0, 1.25, 0.35]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.25, 24]} />
        <meshStandardMaterial color={COLORS.panel} />
      </mesh>
      {/* Object being photographed */}
      <mesh position={[0, 0.18, 1.2]}>
        <boxGeometry args={[0.55, 0.35, 0.55]} />
        <meshStandardMaterial color={COLORS.panel} />
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

  return (
    <group ref={ref}>
      {/* Body */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.45, 0.6, 0.3]} />
        <meshStandardMaterial color={COLORS.base} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.95, 0]}>
        <boxGeometry args={[0.35, 0.35, 0.35]} />
        <meshStandardMaterial color={COLORS.panel} />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.1, 0.1, 0]}>
        <boxGeometry args={[0.15, 0.3, 0.15]} />
        <meshStandardMaterial color={COLORS.panel} />
      </mesh>
      <mesh position={[0.1, 0.1, 0]}>
        <boxGeometry args={[0.15, 0.3, 0.15]} />
        <meshStandardMaterial color={COLORS.panel} />
      </mesh>
    </group>
  );
}

function Task({ task }: { task: ActiveTask }) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  // Useful constants. Memoize geometry sizes to avoid recreating each frame.
  const ringGeometry = useMemo(() => new THREE.RingGeometry(0.32, 0.42, 32), []);
  const fullDuration = task.expiresAt - task.spawnedAt;

  useFrame((state) => {
    if (!groupRef.current || !ringRef.current) return;
    const now = performance.now();
    const remaining = Math.max(0, task.expiresAt - now);
    const ratio = fullDuration > 0 ? remaining / fullDuration : 0;
    // Hover the icon slightly.
    groupRef.current.position.y =
      2.2 + Math.sin(state.clock.elapsedTime * 4 + task.spawnedAt) * 0.05;

    // Shrink the ring as time elapses (acts as a depleting timer).
    ringRef.current.scale.set(ratio, ratio, 1);

    // Turn the ring red in the last 25% to grab attention.
    const mat = ringRef.current.material as THREE.MeshBasicMaterial;
    mat.color.set(ratio < 0.25 ? COLORS.warning : COLORS.taskRing);
  });

  const stationPos = STATION_POSITIONS[task.stationId];

  return (
    <group
      ref={groupRef}
      position={[stationPos[0], 2.2, stationPos[2]]}
    >
      {/* Solid square icon */}
      <mesh>
        <boxGeometry args={[0.45, 0.45, 0.45]} />
        <meshStandardMaterial color={COLORS.taskFill} />
      </mesh>
      {/* Timer ring */}
      <mesh ref={ringRef} rotation={[0, 0, 0]} position={[0, 0, 0.3]}>
        <primitive object={ringGeometry} attach="geometry" />
        <meshBasicMaterial color={COLORS.taskRing} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
