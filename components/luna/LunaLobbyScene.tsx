"use client";

import { MusicMuteButton } from "@/components/survivor/SurvivorMusic";
import LunaLobbyDogBackdrop from "@/components/luna/LunaLobbyDogBackdrop";

interface LunaLobbySceneProps {
  children: React.ReactNode;
}

/** Full-bleed scary lobby — pixel Luna dog looms behind the form. */
export default function LunaLobbyScene({ children }: LunaLobbySceneProps) {
  return (
    <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden bg-[#030304]">
      <LunaLobbyDogBackdrop />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 65%, rgba(120, 0, 0, 0.28) 0%, transparent 62%), radial-gradient(ellipse 100% 80% at 50% 100%, rgba(0, 0, 0, 0.92) 0%, transparent 55%), linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 35%, rgba(0,0,0,0.88) 100%)",
        }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] opacity-[0.14] mix-blend-overlay"
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

export function LunaLobbyCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`w-full max-w-md sm:max-w-lg rounded-sm border border-red-900/50 bg-black/75 backdrop-blur-md shadow-[0_0_56px_rgba(120,0,0,0.22),inset_0_1px_0_rgba(255,80,40,0.08)] p-5 sm:p-8 ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(160deg, rgba(0,0,0,0.88) 0%, rgba(60,8,8,0.22) 55%, rgba(0,0,0,0.82) 100%)",
      }}
    >
      {children}
    </div>
  );
}

export function LunaLobbyPrimaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>
) {
  const { className = "", disabled, ...rest } = props;
  return (
    <button
      {...rest}
      disabled={disabled}
      className={`w-full min-h-[48px] font-pixel text-[9px] sm:text-[10px] tracking-[0.15em] uppercase px-5 py-3 text-white border-2 border-red-200/80 disabled:opacity-50 active:scale-[0.99] transition-transform ${className}`}
      style={{
        background: "linear-gradient(135deg, #dc2626 0%, #450a0a 100%)",
        boxShadow: disabled ? undefined : "4px 4px 0 rgba(255,80,60,0.45)",
        textShadow: "0 0 12px rgba(255,40,20,0.6)",
      }}
    />
  );
}
