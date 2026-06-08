"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Room } from "colyseus.js";
import type { PublicRedLightState } from "@/lib/red-light-config";
import { joinRedLightRoom } from "@/lib/red-light-client";
import SlimeAvatar from "@/components/survivor/SlimeAvatar";
import {
  DEFAULT_NAME_COLOR,
  DEFAULT_SLIME_COLOR,
  SLIME_COLORS,
  parseSlimeColor,
  type SlimeColor,
} from "@/lib/survivor-slime";

const RedLightGameCanvas = dynamic(() => import("./RedLightGameCanvas"), {
  ssr: false,
});

type RoomPhase = "WAITING" | "COUNTDOWN" | "PLAYING" | "ENDED";
type Phase = "lobby" | "joining" | "connecting" | "inRoom" | "standby" | "noMatch";

const inputClassName =
  "w-full bg-black/40 border border-pink-900/50 px-3 py-3 min-h-[48px] text-base sm:text-sm text-pink-50";

function CountdownBanner({ countdownEndsAtMs }: { countdownEndsAtMs: number }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, countdownEndsAtMs - Date.now()));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [countdownEndsAtMs]);
  const sec = Math.ceil(left / 1000);
  return (
    <div className="rounded border border-green-500/40 bg-green-950/40 px-4 py-3 text-center">
      <p className="font-pixel text-[8px] tracking-[0.3em] text-green-400">
        무궁화 꽃이 피었습니다
      </p>
      <p className="font-pixel text-lg mt-2 text-green-300 tabular-nums">{sec}s</p>
    </div>
  );
}

export default function RedLightClient({
  initialState,
}: {
  initialState: PublicRedLightState;
}) {
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
        const res = await fetch("/api/red-light/state", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as PublicRedLightState;
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
        if (status === "PLAYING" || status === "ENDED") setPhase("inRoom");
        else setPhase("standby");
      } catch (e) {
        console.warn("[red-light] state read failed", e);
      }
    };
    syncFromState();
    room.onStateChange(syncFromState);
  }, []);

  const join = async (spectate = false) => {
    setError(null);
    setPhase("joining");
    try {
      const tokenRes = await fetch("/api/red-light/match-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, displayName, spectate }),
      });
      const tokenData = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok) throw new Error(tokenData.error || "Could not join lobby.");

      setPhase("connecting");
      const { room } = await joinRedLightRoom({
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
    <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {phase === "inRoom" && roomRef.current ? (
        <div className="flex-1 min-h-0 flex flex-col relative">
          <RedLightGameCanvas room={roomRef.current} onLeave={leave} />
        </div>
      ) : phase === "standby" ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#E8998D] via-[#E8C99B] to-[#D4AF7A]">
          <div className="max-w-sm w-full rounded-lg border border-pink-900/30 bg-black/50 backdrop-blur p-6 text-center space-y-4">
            <p className="font-pixel text-[8px] tracking-[0.35em] text-pink-300">
              Red Light Green Light
            </p>
            <p className="font-pixel-body text-xl text-pink-50">
              {roomStatus === "COUNTDOWN" ? "Get ready…" : "In lobby"}
            </p>
            {roomStatus === "COUNTDOWN" && countdownEndsAtMs > 0 && (
              <CountdownBanner countdownEndsAtMs={countdownEndsAtMs} />
            )}
            <p className="text-sm text-pink-200/70">
              {aliveInRoom} / {serverState.maxPlayers} players ready
            </p>
            <button
              type="button"
              onClick={leave}
              className="w-full border border-pink-500/50 text-pink-200 text-[11px] uppercase tracking-widest py-3 hover:bg-pink-950/40"
            >
              Leave lobby
            </button>
          </div>
        </div>
      ) : (
        <div
          className="flex-1 overflow-y-auto flex items-center justify-center p-4 sm:p-8"
          style={{
            background:
              "linear-gradient(180deg, #E8998D 0%, #F5D4A8 45%, #E8C99B 100%)",
          }}
        >
          <div className="w-full max-w-md space-y-4">
            <div className="text-center mb-2">
              <p
                className="font-pixel text-[8px] sm:text-[9px] tracking-[0.4em] text-pink-600"
                style={{ textShadow: "0 0 18px rgba(236,72,153,0.5)" }}
              >
                Red Light Green Light
              </p>
              <h1
                className="font-pixel text-sm sm:text-base md:text-lg mt-4 leading-relaxed uppercase text-[#2a1020]"
                style={{ textShadow: "2px 2px 0 rgba(255,255,255,0.35)" }}
              >
                Don&apos;t move on red
              </h1>
              <p className="font-pixel-body text-lg sm:text-xl text-[#4a2030]/80 mt-3">
                {serverState.maxPlayers} players · hold to cross in ~2 min
              </p>
            </div>

            {phase === "noMatch" ? (
              <div className="rounded-lg border border-pink-900/20 bg-black/30 backdrop-blur p-6 text-center">
                <p className="font-pixel-body text-lg text-pink-100/70">
                  No match open yet. Watch for the next drop.
                </p>
              </div>
            ) : (
              <>
                {lobbyCounting && (
                  <CountdownBanner countdownEndsAtMs={lobbyCountdownMs} />
                )}

                <div className="rounded-lg border border-pink-900/20 bg-black/35 backdrop-blur p-5">
                  <p className="font-pixel text-[7px] tracking-[0.25em] text-green-400">
                    Prize
                  </p>
                  <p className="font-pixel-body text-xl sm:text-2xl font-bold mt-2 text-pink-50">
                    {serverState.prizeTitle}
                  </p>
                  <p className="font-pixel-body text-base text-pink-200/60 mt-2">
                    {serverState.currentMatch?.participantCount ?? 0} registered
                  </p>
                </div>

                <div className="rounded-lg border border-pink-900/20 bg-black/35 backdrop-blur p-5">
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
                    <button
                      type="button"
                      onClick={() => join(true)}
                      disabled={phase === "joining" || phase === "connecting"}
                      className="w-full bg-[#E91E8C] hover:bg-pink-600 text-white font-pixel text-[10px] tracking-widest py-4 min-h-[52px] disabled:opacity-50"
                    >
                      {phase === "joining" || phase === "connecting"
                        ? "CONNECTING…"
                        : "WATCH LIVE"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => join(false)}
                      disabled={phase === "joining" || phase === "connecting"}
                      className="w-full bg-green-600 hover:bg-green-500 text-white font-pixel text-[10px] tracking-widest py-4 min-h-[52px] disabled:opacity-50 shadow-[0_0_24px_rgba(34,197,94,0.4)]"
                    >
                      {phase === "joining" || phase === "connecting"
                        ? "CONNECTING…"
                        : "JOIN GAME"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
