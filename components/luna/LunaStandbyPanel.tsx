"use client";

import { useEffect, useState } from "react";
import SlimeAvatar from "@/components/survivor/SlimeAvatar";
import type { SlimeColor } from "@/lib/survivor-slime";
import LunaLobbyScene, { LunaLobbyCard } from "@/components/luna/LunaLobbyScene";

type RoomPhase = "WAITING" | "COUNTDOWN" | "PLAYING" | "ENDED";

export default function LunaStandbyPanel({
  status,
  countdownEndsAtMs,
  alive,
  displayName,
  slimeColor,
  onLeave,
}: {
  status: RoomPhase;
  countdownEndsAtMs: number;
  alive: number;
  displayName: string;
  slimeColor: SlimeColor;
  onLeave: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const remainingMs =
    countdownEndsAtMs > 0 ? Math.max(0, countdownEndsAtMs - now) : 0;
  const remainingS = Math.ceil(remainingMs / 1000);
  const counting = status === "COUNTDOWN" && countdownEndsAtMs > 0;

  return (
    <LunaLobbyScene>
      <LunaLobbyCard className="text-center space-y-6">
        <div className="flex flex-col items-center gap-3">
          <SlimeAvatar color={slimeColor} face={0} accessories={0} size={112} />
          <h2 className="text-2xl font-bold mt-1 tracking-widest uppercase">
            {displayName ? displayName : "You're in."}
          </h2>
        </div>

        <p className="text-[10px] uppercase tracking-[0.3em] text-amber-400">
          {counting ? "Luna is coming" : "In lobby"}
        </p>

        <p className="text-xs text-neutral-400">
          {counting
            ? "Run when the timer hits zero — Luna chases until one survives."
            : "Waiting for admin to start the countdown."}
        </p>

        {counting ? (
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-neutral-500">
              Starts in
            </p>
            <p className="text-7xl font-bold tabular-nums leading-none mt-2 text-white">
              {remainingS}
              <span className="text-xl text-neutral-500 ml-1">s</span>
            </p>
          </div>
        ) : (
          <div className="py-4">
            <div className="flex items-center justify-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <p className="text-sm uppercase tracking-widest text-neutral-300">
                Standby
              </p>
            </div>
          </div>
        )}

        <div className="text-xs text-neutral-400 border-t border-white/10 pt-4 space-y-1">
          <p>
            <span className="text-white">{alive}</span> runner
            {alive === 1 ? "" : "s"} in the arena
          </p>
          <p className="text-[10px] text-neutral-500 leading-relaxed">
            WASD or left stick to sprint. No guns — outrun Luna and the shrinking
            zone. Last one standing wins.
          </p>
        </div>

        <button
          type="button"
          onClick={onLeave}
          className="text-[10px] tracking-widest uppercase text-neutral-400 hover:text-white transition-colors min-h-[44px]"
        >
          Leave lobby
        </button>
      </LunaLobbyCard>
    </LunaLobbyScene>
  );
}

function LunaCountdownBanner({
  countdownEndsAtMs,
  label = "Match starts in",
}: {
  countdownEndsAtMs: number;
  label?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const remainingS = Math.ceil(Math.max(0, countdownEndsAtMs - now) / 1000);
  if (remainingS <= 0) return null;

  return (
    <div className="text-center py-3 px-4 rounded-sm border border-amber-500/30 bg-amber-950/30">
      <p className="text-[10px] uppercase tracking-[0.25em] text-amber-400">
        {label}
      </p>
      <p className="text-4xl font-bold tabular-nums text-white mt-1">
        {remainingS}
        <span className="text-base text-neutral-500 ml-1">s</span>
      </p>
    </div>
  );
}

export { LunaCountdownBanner };
