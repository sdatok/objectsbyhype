"use client";

/**
 * Pure-CSS visual overlay layered on top of the canvas: thin scanlines plus a
 * radial vignette darkening the corners. Pointer-events disabled so it never
 * interferes with mouse aim/click. Kept as its own file so we can tune the
 * look without touching the canvas render loop.
 */
export default function RetroOverlay() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.045) 0px, rgba(255,255,255,0.045) 1px, transparent 1px, transparent 3px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </>
  );
}
