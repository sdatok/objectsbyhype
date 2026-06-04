"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Room } from "colyseus.js";
import type { PublicLunaState } from "@/lib/luna-config";
import { joinLunaRoom } from "@/lib/luna-client";
import LunaLobbyScene, {
  LunaLobbyCard,
  LunaLobbyPrimaryButton,
} from "@/components/luna/LunaLobbyScene";
import LunaStandbyPanel, { LunaCountdownBanner } from "@/components/luna/LunaStandbyPanel";
import { SurvivorMusicProvider } from "@/components/survivor/SurvivorMusic";
import SlimeAvatar from "@/components/survivor/SlimeAvatar";
import {
  DEFAULT_NAME_COLOR,
  DEFAULT_SLIME_COLOR,
  SLIME_COLORS,
  parseSlimeColor,
  type SlimeColor,
} from "@/lib/survivor-slime";

const LunaGameCanvas = dynamic(() => import("./LunaGameCanvas"), { ssr: false });

type RoomPhase = "WAITING" | "COUNTDOWN" | "PLAYING" | "ENDED";
type Phase = "lobby" | "joining" | "connecting" | "inRoom" | "standby" | "noMatch";

const inputClassName =
  "w-full bg-black/40 border border-neutral-700 px-3 py-3 min-h-[48px] text-base sm:text-sm";

export default function LunaClient({ initialState }: { initialState: PublicLunaState }) {
  const [serverState, setServerState] = useState(initialState);
  const [phase, setPhase] = useState<Phase>(
    initialState.currentMatch ? "lobby" : "noMatch"
  );
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [slimeColor, setSlimeColor] = useState<SlimeColor>(DEFAULT_SLIME_COLOR);
  const [nameColor] = useState(DEFAULT_NAME_COLOR);
  const [error, setError] = useState<string | null>(null);
  const [roomStatus, setRoomStatus] = useState<RoomPhase>("WAITING");
  const [countdownEndsAtMs, setCountdownEndsAtMs] = useState(0);
  const [aliveInRoom, setAliveInRoom] = useState(0);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    const id = window.setInterval(async () => {
      try {
        const res = await fetch("/api/luna/state", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as PublicLunaState;
        setServerState(next);
        if (!next.currentMatch && phase !== "inRoom" && phase !== "standby") {
          setPhase("noMatch");
        } else if (phase === "noMatch" && next.currentMatch) {
          setPhase("lobby");
        }
      } catch {
        /* ignore */
      }
    }, 4000);
    return () => window.clearInterval(id);
  }, [phase]);

  const attachRoom = useCallback((room: Room) => {
    const syncFromState = () => {
      try {
        const rs = room.state as unknown as {
          status?: RoomPhase;
          countdownEndsAtMs?: number;
          players?: { forEach: (cb: (v: { alive: boolean }) => void) => void };
        };
        const status = (rs?.status ?? "WAITING") as RoomPhase;
        setRoomStatus(status);
        setCountdownEndsAtMs(Number(rs?.countdownEndsAtMs ?? 0));
        let n = 0;
        rs?.players?.forEach?.((p) => {
          if (p?.alive) n++;
        });
        setAliveInRoom(n);
        if (status === "PLAYING") setPhase("inRoom");
        else if (status === "ENDED") {
          setPhase("inRoom");
        } else {
          setPhase("standby");
        }
      } catch (e) {
        console.warn("[luna] state read failed", e);
      }
    };
    syncFromState();
    room.onStateChange(syncFromState);
  }, []);

  const join = async (spectate = false) => {
    setError(null);
    setPhase("joining");
    try {
      const tokenRes = await fetch("/api/luna/match-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, displayName, spectate }),
      });
      const tokenData = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok) throw new Error(tokenData.error || "Could not join lobby.");

      setPhase("connecting");
      const { room } = await joinLunaRoom({
        wsUrl: tokenData.wsUrl || serverState.gameServerWsUrl,
        matchId: tokenData.matchId,
        email: tokenData.email,
        displayName: tokenData.displayName,
        matchToken: tokenData.matchToken,
        issuedAtMs: tokenData.issuedAtMs,
        slimeColor,
        slimeFace: 0,
        slimeAccessories: 0,
        nameColor,
      });
      roomRef.current = room;
      attachRoom(room);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed.");
      setPhase(serverState.currentMatch ? "lobby" : "noMatch");
    }
  };

  const leave = () => {
    roomRef.current?.leave();
    roomRef.current = null;
    setPhase(serverState.currentMatch ? "lobby" : "noMatch");
  };

  const lobbyCountdownMs = serverState.currentMatch?.countdownEndsAtMs ?? 0;
  const lobbyCounting =
    serverState.currentMatch?.status === "COUNTDOWN" && lobbyCountdownMs > 0;
  const matchLive = serverState.currentMatch?.status === "PLAYING";

  return (
    <SurvivorMusicProvider>
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {phase === "inRoom" && roomRef.current ? (
          <div className="flex-1 min-h-0 flex flex-col relative">
            <LunaGameCanvas room={roomRef.current} onLeave={leave} />
          </div>
        ) : phase === "standby" ? (
          <LunaStandbyPanel
            status={roomStatus}
            countdownEndsAtMs={countdownEndsAtMs}
            maxPlayers={serverState.maxPlayers}
            alive={aliveInRoom}
            displayName={displayName}
            slimeColor={slimeColor}
            onLeave={leave}
          />
        ) : (
          <LunaLobbyScene>
            <div className="w-full max-w-md space-y-4">
              <div className="text-center mb-2">
                <p
                  className="font-pixel text-[8px] sm:text-[9px] tracking-[0.4em] text-red-500"
                  style={{ textShadow: "0 0 18px rgba(220,38,38,0.75)" }}
                >
                  Escape Luna
                </p>
                <h1
                  className="font-pixel text-sm sm:text-base md:text-lg mt-4 leading-relaxed uppercase"
                  style={{
                    textShadow:
                      "0 0 24px rgba(255,40,20,0.55), 2px 2px 0 rgba(0,0,0,0.9)",
                  }}
                >
                  Run from the dog
                </h1>
                <p className="font-pixel-body text-lg sm:text-xl text-red-200/70 mt-3 tracking-wide">
                  {serverState.maxPlayers} runners · last one standing wins.
                </p>
              </div>

              {phase === "noMatch" ? (
                <LunaLobbyCard>
                  <p className="font-pixel-body text-lg text-neutral-400">
                    No match is open yet. Watch for the next Escape Luna drop.
                  </p>
                </LunaLobbyCard>
              ) : (
                <>
                  {lobbyCounting && (
                    <LunaCountdownBanner countdownEndsAtMs={lobbyCountdownMs} />
                  )}

                  <LunaLobbyCard>
                    <p className="font-pixel text-[7px] tracking-[0.25em] text-red-400">
                      Prize
                    </p>
                    <p className="font-pixel-body text-xl sm:text-2xl font-bold mt-2 text-red-50">
                      {serverState.prizeTitle}
                    </p>
                    <p className="font-pixel-body text-base text-neutral-500 mt-2">
                      {serverState.currentMatch?.participantCount ?? 0} registered ·{" "}
                      {lobbyCounting
                        ? "Countdown live"
                        : serverState.currentMatch?.status === "PLAYING"
                          ? "Match in progress"
                          : "Waiting for admin start"}
                    </p>
                  </LunaLobbyCard>

                  <LunaLobbyCard>
                    <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
                      <SlimeAvatar color={slimeColor} face={0} accessories={0} size={56} />
                      <div className="flex-1 w-full space-y-3">
                        <input
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Display name"
                          autoComplete="nickname"
                          className={inputClassName}
                        />
                        <input
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Email"
                          type="email"
                          autoComplete="email"
                          inputMode="email"
                          className={inputClassName}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2.5 mb-4">
                      {SLIME_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Slime color ${c}`}
                          onClick={() => setSlimeColor(parseSlimeColor(c))}
                          className={`w-9 h-9 sm:w-6 sm:h-6 rounded-full border-2 ${
                            slimeColor === c ? "border-white" : "border-transparent"
                          }`}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                    {error && <p className="text-sm text-rose-400 mb-3">{error}</p>}
                    {matchLive ? (
                      <LunaLobbyPrimaryButton
                        onClick={() => join(true)}
                        disabled={phase === "joining" || phase === "connecting"}
                      >
                        {phase === "joining" || phase === "connecting"
                          ? "CONNECTING…"
                          : "WATCH LIVE"}
                      </LunaLobbyPrimaryButton>
                    ) : (
                      <LunaLobbyPrimaryButton
                        onClick={() => join(false)}
                        disabled={phase === "joining" || phase === "connecting"}
                      >
                        {phase === "joining" || phase === "connecting"
                          ? "CONNECTING…"
                          : "JOIN & RUN"}
                      </LunaLobbyPrimaryButton>
                    )}
                  </LunaLobbyCard>
                </>
              )}
            </div>
          </LunaLobbyScene>
        )}
      </main>
    </SurvivorMusicProvider>
  );
}
