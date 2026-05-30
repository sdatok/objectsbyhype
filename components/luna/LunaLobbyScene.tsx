"use client";

import { MusicMuteButton } from "@/components/survivor/SurvivorMusic";

interface LunaLobbySceneProps {
  children: React.ReactNode;
}

/** Full-bleed dark lobby for Escape Luna — no letterboxed poster. */
export default function LunaLobbyScene({ children }: LunaLobbySceneProps) {
  return (
    <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden bg-[#050508]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 50% 110%, rgba(120, 20, 20, 0.35) 0%, transparent 55%), radial-gradient(ellipse 90% 60% at 50% -10%, rgba(40, 20, 60, 0.45) 0%, transparent 50%), linear-gradient(180deg, #0a0a10 0%, #050508 45%, #120808 100%)",
        }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.16] mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 3px)",
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
      className={`w-full max-w-md sm:max-w-lg rounded-sm border border-amber-500/25 bg-black/65 backdrop-blur-md shadow-[0_0_48px_rgba(180,80,20,0.12),inset_0_1px_0_rgba(255,255,255,0.06)] p-5 sm:p-8 ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(160deg, rgba(0,0,0,0.78) 0%, rgba(80,30,10,0.16) 55%, rgba(0,0,0,0.62) 100%)",
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
      className={`w-full min-h-[48px] font-bold text-sm tracking-widest uppercase px-5 py-3 text-white border-2 border-white disabled:opacity-50 active:scale-[0.99] transition-transform ${className}`}
      style={{
        background: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)",
        boxShadow: disabled ? undefined : "4px 4px 0 rgba(255,255,255,0.85)",
      }}
    />
  );
}
