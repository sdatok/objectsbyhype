"use client";

import IslandSkyline from "./IslandSkyline";

const VENDORS = [
  "TOMY",
  "K-T CORP",
  "6HORIZONLLC",
  "SRC",
  "INTERNET MONEY",
  "PAX ECOMMERCE",
  "GOAT",
  "GUS SUPPLY",
  "DAN SPORTING",
  "ROR SPLY",
] as const;

interface IslandLobbyBackdropProps {
  children: React.ReactNode;
  /** Short label above the card, e.g. "Lobby" or "In lobby" */
  eyebrow?: string;
}

/**
 * Pre-game shell: purple night sky, composited pixel island skyline, and a
 * glass card slot for lobby / standby forms.
 */
export default function IslandLobbyBackdrop({
  children,
  eyebrow = "Internet Money Island",
}: IslandLobbyBackdropProps) {
  return (
    <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Night sky */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #0a0118 0%, #1a0a3e 32%, #2d1060 55%, #12082a 78%, #061525 100%)",
        }}
      />

      {/* Stars */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage: `
            radial-gradient(1px 1px at 12% 14%, rgba(255,255,255,0.9), transparent),
            radial-gradient(1px 1px at 78% 10%, rgba(255,255,255,0.7), transparent),
            radial-gradient(1.5px 1.5px at 44% 6%, rgba(196,181,253,0.9), transparent),
            radial-gradient(1px 1px at 90% 22%, rgba(255,255,255,0.5), transparent),
            radial-gradient(1px 1px at 22% 24%, rgba(255,255,255,0.45), transparent),
            radial-gradient(1px 1px at 65% 18%, rgba(255,255,255,0.6), transparent)
          `,
        }}
      />

      {/* Moon */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[4%] right-[12%] w-14 h-14 sm:w-20 sm:h-20 rounded-full opacity-90"
        style={{
          background:
            "radial-gradient(circle at 35% 35%, #f5d0fe 0%, #c026d3 45%, transparent 70%)",
          boxShadow: "0 0 50px rgba(192,38,211,0.4)",
        }}
      />

      {/* Scanlines + vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-35"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 3px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 35%, transparent 50%, rgba(0,0,0,0.5) 100%)",
        }}
      />

      {/* Foreground: card in sky, island scene pinned to bottom */}
      <div className="relative z-10 flex-1 flex flex-col min-h-0">
        <div className="shrink-0 px-4 pt-4 sm:pt-5 text-center">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.35em] text-fuchsia-300/90">
            {eyebrow}
          </p>
          <p className="mt-2 text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-violet-300/45 max-w-3xl mx-auto leading-relaxed hidden sm:block">
            {VENDORS.join(" · ")}
          </p>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 py-4 sm:py-6 min-h-0">
          {children}
        </div>

        <div className="shrink-0 pb-3 sm:hidden overflow-x-auto px-4">
          <div className="flex gap-4 whitespace-nowrap text-[9px] uppercase tracking-[0.18em] text-violet-300/45">
            {VENDORS.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
        </div>

        <IslandSkyline />
      </div>
    </div>
  );
}

/** Shared glass card for lobby / standby content sitting over the skyline. */
export function IslandLobbyCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`w-full max-w-md sm:max-w-lg rounded-sm border border-fuchsia-500/25 bg-black/55 backdrop-blur-xl shadow-[0_0_60px_rgba(124,58,237,0.22),inset_0_1px_0_rgba(255,255,255,0.06)] p-6 sm:p-8 ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(145deg, rgba(88,28,135,0.18) 0%, rgba(0,0,0,0.72) 45%, rgba(30,10,60,0.35) 100%)",
      }}
    >
      {children}
    </div>
  );
}
