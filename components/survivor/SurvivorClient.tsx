"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Room } from "colyseus.js";
import type { PublicSurvivorState } from "@/lib/survivor-config";
import { joinSurvivorRoom } from "@/lib/survivor-client";

// Canvas needs the browser only.
const GameCanvas = dynamic(() => import("./GameCanvas"), { ssr: false });

type Phase =
  | "lobby" // form to enter name + email
  | "joining" // POSTing /api/survivor/match-token
  | "connecting" // Colyseus joinOrCreate
  | "inRoom" // connected; GameCanvas drives the visuals
  | "disconnected" // server closed our connection
  | "noMatch"; // no current match (admin hasn't started one yet)

interface SurvivorClientProps {
  initialState: PublicSurvivorState;
}

const NAME_KEY = "obh-survivor-name";
const EMAIL_KEY = "obh-survivor-email";

export default function SurvivorClient({ initialState }: SurvivorClientProps) {
  const [serverState, setServerState] = useState<PublicSurvivorState>(initialState);
  const [phase, setPhase] = useState<Phase>(
    initialState.currentMatch ? "lobby" : "noMatch"
  );
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [roomReady, setRoomReady] = useState(false);
  const roomRef = useRef<Room | null>(null);

  // Restore previously-used name/email so returning visitors don't retype.
  useEffect(() => {
    try {
      setDisplayName(localStorage.getItem(NAME_KEY) ?? "");
      setEmail(localStorage.getItem(EMAIL_KEY) ?? "");
    } catch {
      // ignore localStorage failures (private mode etc.)
    }
  }, []);

  // Poll public state every 4s while we're outside the room so we notice an
  // admin opening / closing a match.
  useEffect(() => {
    if (phase === "inRoom") return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await fetch("/api/survivor/state", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as PublicSurvivorState;
        if (cancelled) return;
        setServerState(next);
        if (phase === "noMatch" && next.currentMatch) {
          setPhase("lobby");
        }
        if (phase === "lobby" && !next.currentMatch) {
          setPhase("noMatch");
        }
      } catch {
        // ignore transient failures
      }
    };
    const id = window.setInterval(refresh, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [phase]);

  const join = useCallback(async () => {
    setError(null);
    const trimmedName = displayName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName || !trimmedEmail) {
      setError("Display name and email are required.");
      return;
    }
    try {
      localStorage.setItem(NAME_KEY, trimmedName);
      localStorage.setItem(EMAIL_KEY, trimmedEmail);
    } catch {
      /* ignore */
    }

    setPhase("joining");
    try {
      const res = await fetch("/api/survivor/match-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmedName, email: trimmedEmail }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "Could not join lobby");
      }

      setPhase("connecting");
      const room = await joinSurvivorRoom({
        wsUrl: json.wsUrl,
        matchId: json.matchId,
        email: json.email,
        displayName: json.displayName,
        matchToken: json.matchToken,
        issuedAtMs: json.issuedAtMs,
      });

      roomRef.current = room;
      setRoomReady(true);
      setPhase("inRoom");

      room.onLeave(() => {
        if (roomRef.current === room) {
          roomRef.current = null;
          setRoomReady(false);
          setPhase("disconnected");
        }
      });
      room.onError((code, message) => {
        console.error("[survivor] room error", code, message);
        setError(message ?? "Room error");
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not join match";
      setError(message);
      setPhase("lobby");
    }
  }, [displayName, email]);

  const leaveAndReset = useCallback(() => {
    const room = roomRef.current;
    if (room) {
      try {
        room.leave();
      } catch {
        /* ignore */
      }
    }
    roomRef.current = null;
    setRoomReady(false);
    setError(null);
    setPhase(serverState.currentMatch ? "lobby" : "noMatch");
  }, [serverState.currentMatch]);

  // Auto-leave on unmount.
  useEffect(() => {
    return () => {
      const room = roomRef.current;
      if (room) {
        try {
          room.leave();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  return (
    <main className="min-h-[100dvh] flex flex-col">
      <Header serverState={serverState} />

      {phase === "noMatch" && <NoMatchPanel last={serverState.lastWinner} />}

      {(phase === "lobby" || phase === "joining" || phase === "connecting") && (
        <LobbyPanel
          serverState={serverState}
          displayName={displayName}
          email={email}
          onName={setDisplayName}
          onEmail={setEmail}
          onJoin={join}
          phase={phase}
          error={error}
        />
      )}

      {phase === "disconnected" && (
        <DisconnectedPanel onRetry={leaveAndReset} />
      )}

      {phase === "inRoom" && roomReady && roomRef.current && (
        <GameCanvas
          room={roomRef.current}
          onLeave={leaveAndReset}
        />
      )}
    </main>
  );
}

// ============================================================
// Pieces
// ============================================================

function Header({ serverState }: { serverState: PublicSurvivorState }) {
  return (
    <header className="w-full border-b border-white/10 px-6 py-4 flex items-baseline justify-between flex-wrap gap-3">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-fuchsia-400">
          OBH Survivor
        </p>
        <h1 className="text-xl sm:text-2xl font-bold mt-1">
          {serverState.prizeTitle}
        </h1>
        {serverState.prizeDescription && (
          <p className="text-xs text-neutral-400 mt-1 max-w-prose">
            {serverState.prizeDescription}
          </p>
        )}
      </div>
      <p className="text-[10px] uppercase tracking-[0.25em] text-neutral-500">
        25 players · last alive wins
      </p>
    </header>
  );
}

function NoMatchPanel({
  last,
}: {
  last: PublicSurvivorState["lastWinner"];
}) {
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-400">
          Standby
        </p>
        <h2 className="text-2xl font-bold">No match open right now.</h2>
        <p className="text-sm text-neutral-400">
          Matches are admin-started. Follow OBH on Instagram for drops, or
          keep this tab open — the lobby opens here when one starts.
        </p>
        {last && (
          <p className="text-xs text-neutral-500 mt-6">
            Last winner:{" "}
            <span className="text-white">{last.displayName}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function LobbyPanel(props: {
  serverState: PublicSurvivorState;
  displayName: string;
  email: string;
  onName: (v: string) => void;
  onEmail: (v: string) => void;
  onJoin: () => void;
  phase: Phase;
  error: string | null;
}) {
  const { serverState, displayName, email, onName, onEmail, onJoin, phase, error } = props;
  const busy = phase === "joining" || phase === "connecting";
  const status = serverState.currentMatch?.status;
  const participantCount = serverState.currentMatch?.participantCount ?? 0;

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) onJoin();
        }}
        className="w-full max-w-md space-y-5 border border-white/10 bg-white/[0.02] backdrop-blur-md p-6 sm:p-8 rounded"
      >
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-fuchsia-400">
            Lobby {status ? `· ${status.toLowerCase()}` : ""}
          </p>
          <h2 className="text-xl font-bold mt-2">Join the arena</h2>
          <p className="text-xs text-neutral-400 mt-1">
            {participantCount} {participantCount === 1 ? "player" : "players"}{" "}
            queued. Match begins when the host starts it.
          </p>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-widest text-neutral-400 mb-2">
            Display name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => onName(e.target.value)}
            placeholder="GAMERTAG"
            maxLength={24}
            required
            className="w-full bg-black border border-white/15 px-3 py-3 text-base text-white placeholder-neutral-600 focus:outline-none focus:border-fuchsia-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-widest text-neutral-400 mb-2">
            Email (for prize delivery)
          </label>
          <input
            type="email"
            inputMode="email"
            autoCapitalize="off"
            autoCorrect="off"
            value={email}
            onChange={(e) => onEmail(e.target.value)}
            placeholder="you@email.com"
            required
            className="w-full bg-black border border-white/15 px-3 py-3 text-base text-white placeholder-neutral-600 focus:outline-none focus:border-fuchsia-500 transition-colors"
          />
        </div>

        {error && (
          <p className="text-xs text-rose-400 break-words">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full font-bold text-sm tracking-widest uppercase px-5 py-3 text-white border-2 border-white disabled:opacity-50"
          style={{
            background:
              "linear-gradient(135deg, #c026d3 0%, #7c3aed 100%)",
            boxShadow: "4px 4px 0 #fff",
          }}
        >
          {phase === "joining"
            ? "Joining…"
            : phase === "connecting"
            ? "Connecting…"
            : "Enter lobby"}
        </button>

        <p className="text-[10px] text-neutral-500 leading-relaxed">
          Desktop only for v1. Movement: WASD. Aim: mouse. Fire: left click.
          Stay inside the safe zone — it shrinks. Last alive wins. Ties broken
          by kills, then HP.
        </p>
      </form>
    </div>
  );
}

function DisconnectedPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-400">
          Disconnected
        </p>
        <h2 className="text-2xl font-bold">You left the match.</h2>
        <p className="text-sm text-neutral-400">
          If the match is still open, you can rejoin. Otherwise wait for the
          next one.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="text-xs tracking-widest uppercase px-5 py-3 border border-white hover:bg-white hover:text-black transition-colors"
        >
          Back to lobby
        </button>
      </div>
    </div>
  );
}
