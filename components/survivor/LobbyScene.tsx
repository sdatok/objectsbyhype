"use client";

import Image from "next/image";
import { MusicMuteButton } from "./SurvivorMusic";

const POSTER_SRC = "/survivor/survivor-island-poster.png";

interface LobbySceneProps {
  children: React.ReactNode;
}

/**
 * Pre-game backdrop: Survivor Island poster fills the viewport on mobile and
 * desktop (cover + slight zoom on larger screens so letterboxing is gone).
 */
export default function LobbyScene({ children }: LobbySceneProps) {
  return (
    <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden bg-[#0a1628]">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 scale-[1.08] sm:scale-[1.14] md:scale-[1.2] lg:scale-[1.26] origin-center">
          <Image
            src={POSTER_SRC}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[center_38%] sm:object-[center_42%]"
          />
        </div>
      </div>

      {/* Top scrim — keeps the form readable over bright sky */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,12,28,0.72) 0%, rgba(8,12,28,0.28) 32%, transparent 52%, rgba(8,12,28,0.15) 100%)",
        }}
      />

      {/* Subtle retro scanlines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] opacity-[0.18] mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 3px)",
        }}
      />

      <div className="relative z-10 flex-1 flex flex-col min-h-0">
        <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] z-20">
          <MusicMuteButton />
        </div>
        <div className="flex-1 flex items-start sm:items-center justify-center px-4 pt-[max(3.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:py-8 min-h-0 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Glass card — OBH purple accents on a dark panel over the poster sky. */
export function LobbyCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`w-full max-w-md sm:max-w-lg rounded-sm border border-fuchsia-500/30 bg-black/60 backdrop-blur-md shadow-[0_0_48px_rgba(124,58,237,0.18),inset_0_1px_0_rgba(255,255,255,0.06)] p-6 sm:p-8 ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(160deg, rgba(0,0,0,0.72) 0%, rgba(88,28,135,0.14) 55%, rgba(0,0,0,0.55) 100%)",
      }}
    >
      {children}
    </div>
  );
}

/** Shared primary CTA — classic OBH gradient + white offset shadow. */
export function LobbyPrimaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>
) {
  const { className = "", disabled, ...rest } = props;
  return (
    <button
      {...rest}
      disabled={disabled}
      className={`w-full min-h-[48px] font-bold text-sm tracking-widest uppercase px-5 py-3 text-white border-2 border-white disabled:opacity-50 active:scale-[0.99] transition-transform ${className}`}
      style={{
        background: "linear-gradient(135deg, #c026d3 0%, #7c3aed 100%)",
        boxShadow: disabled ? undefined : "4px 4px 0 #fff",
      }}
    />
  );
}
