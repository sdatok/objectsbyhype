"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Room } from "colyseus.js";
import type { PublicLunaState } from "@/lib/luna-config";
import { joinLunaRoom } from "@/lib/luna-client";
import LobbyScene, { LobbyCard, LobbyPrimaryButton } from "@/components/survivor/LobbyScene";
import SlimeAvatar from "@/components/survivor/SlimeAvatar";
import {
  DEFAULT_NAME_COLOR,
  DEFAULT_SLIME_COLOR,
  SLIME_COLORS,
  parseSlimeColor,
  type SlimeColor,
} from "@/lib/survivor-slime";

const LunaGameCanvas = dynamic(() => import("./LunaGameCanvas"), { ssr: false });

type Phase = "lobby" | "joining" | "connecting" | "inRoom" | "standby" | "noMatch";

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
  const [roomStatus, setRoomStatus] = useState<string>("WAITING");
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    const id = window.setInterval(async () => {
      try {
        const res = await fetch("/api/luna/state", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as PublicLunaState;
        setServerState(next);
        if (!next.currentMatch && phase !== "inRoom") setPhase("noMatch");
        else if (phase === "noMatch" && next.currentMatch) setPhase("lobby");
      } catch {
        /* ignore */
      }
    }, 4000);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    const room = roomRef.current;
    if (!room) return;
    const onChange = () => setRoomStatus(String(room.state.status ?? "WAITING"));
    onChange();
    room.onStateChange(onChange);
    return () => {
      const registry = room.onStateChange as unknown as {
        remove?: (fn: typeof onChange) => void;
      };
      registry.remove?.(onChange);
    };
  }, [phase]);

  useEffect(() => {
    if (phase === "standby" && roomStatus === "PLAYING") setPhase("inRoom");
  }, [phase, roomStatus]);

  const join = async () => {
    setError(null);
    setPhase("joining");
    try {
      const tokenRes = await fetch("/api/luna/match-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, displayName }),
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
      setRoomStatus(String(room.state.status ?? "WAITING"));
      setPhase(room.state.status === "PLAYING" ? "inRoom" : "standby");
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

  if (phase === "inRoom" && roomRef.current) {
    return <LunaGameCanvas room={roomRef.current} onLeave={leave} />;
  }

  return (
    <LobbyScene>
      <div className="w-full max-w-md space-y-4">
        <div className="text-center mb-2">
          <p className="text-[10px] uppercase tracking-[0.35em] text-amber-400">
            Escape Luna
          </p>
          <h1 className="text-2xl font-bold mt-2">Run from the dog</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Last one standing wins. No guns — just sprint.
          </p>
        </div>
      {phase === "noMatch" ? (
        <LobbyCard>
          <p className="text-sm text-neutral-400">
            No match is open yet. Watch for the next Escape Luna drop.
          </p>
        </LobbyCard>
      ) : (
        <>
          <LobbyCard>
            <p className="text-[10px] uppercase tracking-widest text-amber-400">
              Prize
            </p>
            <p className="text-lg font-bold mt-1">{serverState.prizeTitle}</p>
            <p className="text-xs text-neutral-500 mt-2">
              {serverState.currentMatch?.participantCount ?? 0} in lobby ·{" "}
              {roomStatus === "COUNTDOWN" ? "Starting soon" : "Waiting for admin start"}
            </p>
          </LobbyCard>

          <LobbyCard>
            <div className="flex items-center gap-4 mb-4">
              <SlimeAvatar color={slimeColor} face={0} accessories={0} size={56} />
              <div className="flex-1 space-y-3">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Display name"
                  className="w-full bg-black/40 border border-neutral-700 px-3 py-2 text-sm"
                />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full bg-black/40 border border-neutral-700 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {SLIME_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSlimeColor(parseSlimeColor(c))}
                  className={`w-6 h-6 rounded-full border-2 ${
                    slimeColor === c ? "border-white" : "border-transparent"
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
            {error && <p className="text-sm text-rose-400 mb-3">{error}</p>}
            <LobbyPrimaryButton
              onClick={join}
              disabled={phase === "joining" || phase === "connecting"}
            >
              {phase === "joining" || phase === "connecting"
                ? "CONNECTING…"
                : phase === "standby"
                  ? "IN LOBBY — WAITING"
                  : "JOIN & RUN"}
            </LobbyPrimaryButton>
          </LobbyCard>
        </>
      )}
      </div>
    </LobbyScene>
  );
}
