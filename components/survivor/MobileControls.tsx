"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Normalized stick output consumed by GameCanvas each frame. */
export interface VirtualStickState {
  active: boolean;
  moveX: number;
  moveY: number;
  pointerId: number | null;
}

export const emptyStick = (): VirtualStickState => ({
  active: false,
  moveX: 0,
  moveY: 0,
  pointerId: null,
});

const BASE_RADIUS = 56;
const KNOB_RADIUS = 24;
const MAX_DRAG = 48;
/** Aim stick must pass this before auto-fire kicks in. */
const AIM_FIRE_THRESHOLD = 0.18;

interface StickVisual {
  active: boolean;
  knobDx: number;
  knobDy: number;
}

const idleVisual = (): StickVisual => ({
  active: false,
  knobDx: 0,
  knobDy: 0,
});

interface MobileControlsProps {
  moveStickRef: React.MutableRefObject<VirtualStickState>;
  aimStickRef: React.MutableRefObject<VirtualStickState>;
  enabled: boolean;
}

/**
 * Twin-stick overlay for phones/tablets. Left stick moves; right stick aims
 * and auto-fires while pushed past the deadzone (survivor.io-style).
 */
export default function MobileControls({
  moveStickRef,
  aimStickRef,
  enabled,
}: MobileControlsProps) {
  const moveBaseRef = useRef<HTMLDivElement>(null);
  const aimBaseRef = useRef<HTMLDivElement>(null);
  const [moveVis, setMoveVis] = useState<StickVisual>(idleVisual);
  const [aimVis, setAimVis] = useState<StickVisual>(idleVisual);

  const vectorFromPointer = useCallback(
    (clientX: number, clientY: number, baseEl: HTMLDivElement) => {
      const rect = baseEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > MAX_DRAG) {
        dx = (dx / dist) * MAX_DRAG;
        dy = (dy / dist) * MAX_DRAG;
      }
      let nx = dx / MAX_DRAG;
      let ny = dy / MAX_DRAG;
      const len = Math.hypot(nx, ny);
      if (len > 1) {
        nx /= len;
        ny /= len;
      }
      return { nx, ny, knobDx: dx, knobDy: dy };
    },
    []
  );

  const bindStick = useCallback(
    (
      stickRef: React.MutableRefObject<VirtualStickState>,
      setVis: React.Dispatch<React.SetStateAction<StickVisual>>,
      baseRef: React.RefObject<HTMLDivElement | null>
    ) => ({
      onPointerDown(e: React.PointerEvent) {
        if (!enabled || !baseRef.current) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        const { nx, ny, knobDx, knobDy } = vectorFromPointer(
          e.clientX,
          e.clientY,
          baseRef.current
        );
        stickRef.current = {
          active: true,
          moveX: nx,
          moveY: ny,
          pointerId: e.pointerId,
        };
        setVis({ active: true, knobDx, knobDy });
      },
      onPointerMove(e: React.PointerEvent) {
        if (!enabled || !baseRef.current) return;
        if (stickRef.current.pointerId !== e.pointerId) return;
        e.preventDefault();
        const { nx, ny, knobDx, knobDy } = vectorFromPointer(
          e.clientX,
          e.clientY,
          baseRef.current
        );
        stickRef.current = {
          active: true,
          moveX: nx,
          moveY: ny,
          pointerId: e.pointerId,
        };
        setVis({ active: true, knobDx, knobDy });
      },
      onPointerUp(e: React.PointerEvent) {
        if (stickRef.current.pointerId !== e.pointerId) return;
        e.preventDefault();
        stickRef.current = emptyStick();
        setVis(idleVisual());
      },
      onPointerCancel(e: React.PointerEvent) {
        if (stickRef.current.pointerId !== e.pointerId) return;
        stickRef.current = emptyStick();
        setVis(idleVisual());
      },
    }),
    [enabled, vectorFromPointer]
  );

  const moveHandlers = bindStick(moveStickRef, setMoveVis, moveBaseRef);
  const aimHandlers = bindStick(aimStickRef, setAimVis, aimBaseRef);

  // Clear sticks if controls are disabled mid-match (spectator / ended).
  useEffect(() => {
    if (enabled) return;
    moveStickRef.current = emptyStick();
    aimStickRef.current = emptyStick();
    setMoveVis(idleVisual());
    setAimVis(idleVisual());
  }, [enabled, moveStickRef, aimStickRef]);

  if (!enabled) return null;

  return (
    <div
      className="absolute inset-0 z-20 pointer-events-none select-none touch-none"
      aria-hidden
    >
      <Stick
        label="MOVE"
        baseRef={moveBaseRef}
        visual={moveVis}
        accent="#c026d3"
        className="left-4 bottom-[max(1rem,env(safe-area-inset-bottom))]"
        handlers={moveHandlers}
      />
      <Stick
        label="AIM"
        baseRef={aimBaseRef}
        visual={aimVis}
        accent="#22d3ee"
        className="right-4 bottom-[max(1rem,env(safe-area-inset-bottom))]"
        handlers={aimHandlers}
        firing={
          aimVis.active &&
          Math.hypot(aimStickRef.current.moveX, aimStickRef.current.moveY) >=
            AIM_FIRE_THRESHOLD
        }
      />
    </div>
  );
}

function Stick({
  label,
  baseRef,
  visual,
  accent,
  className,
  handlers,
  firing,
}: {
  label: string;
  baseRef: React.RefObject<HTMLDivElement | null>;
  visual: StickVisual;
  accent: string;
  className: string;
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
  firing?: boolean;
}) {
  const size = BASE_RADIUS * 2;
  return (
    <div className={`absolute pointer-events-auto ${className}`}>
      <p
        className="text-[8px] uppercase tracking-[0.35em] text-white/45 text-center mb-2"
        style={{ fontFamily: "ui-monospace, monospace" }}
      >
        {label}
      </p>
      <div
        ref={baseRef}
        className="relative rounded-full border border-white/25 bg-black/35 backdrop-blur-sm"
        style={{
          width: size,
          height: size,
          boxShadow: visual.active
            ? `0 0 24px ${accent}44, inset 0 0 12px rgba(255,255,255,0.04)`
            : "inset 0 0 12px rgba(255,255,255,0.04)",
          borderColor: firing ? accent : undefined,
        }}
        {...handlers}
      >
        <div
          className="absolute rounded-full border border-white/60 bg-white/10"
          style={{
            width: KNOB_RADIUS * 2,
            height: KNOB_RADIUS * 2,
            left: BASE_RADIUS - KNOB_RADIUS + visual.knobDx,
            top: BASE_RADIUS - KNOB_RADIUS + visual.knobDy,
            background: firing
              ? `linear-gradient(135deg, ${accent}88, rgba(255,255,255,0.15))`
              : "rgba(255,255,255,0.12)",
            transition: visual.active ? "none" : "left 120ms, top 120ms",
          }}
        />
      </div>
    </div>
  );
}

/** Touch-first devices and narrow viewports get on-screen sticks. */
export function useMobileControls(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)");
    const narrow = window.matchMedia("(max-width: 1280px)");
    const touch =
      "ontouchstart" in window ||
      (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0);
    const update = () => setMobile(coarse.matches || touch || narrow.matches);
    update();
    coarse.addEventListener("change", update);
    narrow.addEventListener("change", update);
    return () => {
      coarse.removeEventListener("change", update);
      narrow.removeEventListener("change", update);
    };
  }, []);
  return mobile;
}

/** True when aim stick is pushed far enough to fire. */
export function aimStickFiring(stick: VirtualStickState): boolean {
  if (!stick.active) return false;
  return Math.hypot(stick.moveX, stick.moveY) >= AIM_FIRE_THRESHOLD;
}
