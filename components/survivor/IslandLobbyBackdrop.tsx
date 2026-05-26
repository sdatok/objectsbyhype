"use client";

import Image from "next/image";

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
 * Full-viewport pre-game shell: purple night sky, vendor skyline hero, and a
 * glass card slot for lobby / standby forms. Uses the Internet Money Island
 * reference art as the waterfront backdrop.
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
            "linear-gradient(180deg, #0a0118 0%, #1a0a3e 38%, #2d1060 62%, #12082a 100%)",
        }}
      />

      {/* Stars */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage: `
            radial-gradient(1px 1px at 12% 18%, rgba(255,255,255,0.9), transparent),
            radial-gradient(1px 1px at 78% 12%, rgba(255,255,255,0.7), transparent),
            radial-gradient(1.5px 1.5px at 44% 8%, rgba(196,181,253,0.9), transparent),
            radial-gradient(1px 1px at 90% 28%, rgba(255,255,255,0.5), transparent),
            radial-gradient(1px 1px at 22% 32%, rgba(255,255,255,0.45), transparent),
            radial-gradient(1px 1px at 65% 22%, rgba(255,255,255,0.6), transparent)
          `,
        }}
      />

      {/* Moon + horizon glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[6%] right-[14%] w-16 h-16 sm:w-20 sm:h-20 rounded-full opacity-90"
        style={{
          background:
            "radial-gradient(circle at 35% 35%, #f5d0fe 0%, #c026d3 45%, transparent 70%)",
          boxShadow: "0 0 60px rgba(192,38,211,0.45)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[28%] left-0 right-0 h-40"
        style={{
          background:
            "radial-gradient(ellipse 90% 100% at 50% 100%, rgba(124,58,237,0.35), transparent 70%)",
        }}
      />

      {/* Skyline hero — anchored to bottom so buildings sit on the waterline */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[min(52vh,420px)] sm:h-[min(58vh,480px)]"
      >
        <Image
          src="/survivor/internet-money-island.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-bottom opacity-95"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(10,1,24,0.55) 0%, transparent 35%, rgba(0,0,0,0.15) 100%)",
          }}
        />
        {/* Water shimmer */}
        <div
          className="absolute inset-x-0 bottom-0 h-24 sm:h-32 animate-pulse"
          style={{
            background:
              "linear-gradient(180deg, transparent, rgba(124,58,237,0.12) 50%, rgba(192,38,211,0.08))",
            animationDuration: "4s",
          }}
        />
      </div>

      {/* Scanlines + vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-40"
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
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* Foreground */}
      <div className="relative z-10 flex-1 flex flex-col min-h-0">
        <div className="shrink-0 px-4 pt-4 sm:pt-6 text-center">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.35em] text-fuchsia-300/90">
            {eyebrow}
          </p>
          <p className="mt-2 text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-violet-300/50 max-w-3xl mx-auto leading-relaxed hidden sm:block">
            {VENDORS.join(" · ")}
          </p>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 py-6 sm:py-8 min-h-0">
          {children}
        </div>

        {/* Mobile vendor strip */}
        <div className="shrink-0 pb-3 sm:hidden overflow-x-auto px-4">
          <div className="flex gap-4 whitespace-nowrap text-[9px] uppercase tracking-[0.18em] text-violet-300/45">
            {VENDORS.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
        </div>
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
