"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Room } from "colyseus.js";
import type { PublicSurvivorState } from "@/lib/survivor-config";
import { joinSurvivorRoom } from "@/lib/survivor-client";

// Canvas needs the browser only.
const GameCanvas = dynamic(() => import("./GameCanvas"), { ssr: false });

type RoomPhase = "WAITING" | "COUNTDOWN" | "PLAYING" | "ENDED";

type Phase =
  | "lobby" // form to enter name + email
  | "joining" // POSTing /api/survivor/match-token
  | "connecting" // Colyseus joinOrCreate
  | "standby" // connected; waiting for host to start (WAITING/COUNTDOWN)
  | "inRoom" // PLAYING — GameCanvas active
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
  const [roomStatus, setRoomStatus] = useState<RoomPhase>("WAITING");
  const [countdownEndsAtMs, setCountdownEndsAtMs] = useState<number>(0);
  const [aliveInRoom, setAliveInRoom] = useState<number>(0);
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

  /**
   * Mint a token and connect. Returns the live Room on success; throws on
   * any failure. Pulled out so we can transparently retry once when the
   * room rejects us with "match has moved on" — which happens during normal
   * deploy/restart races where the lobby tab held a slightly-stale matchId.
   */
  const attemptJoin = useCallback(
    async (trimmedName: string, trimmedEmail: string) => {
      const res = await fetch("/api/survivor/match-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmedName, email: trimmedEmail }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "Could not join lobby");
      }
      return joinSurvivorRoom({
        wsUrl: json.wsUrl,
        matchId: json.matchId,
        email: json.email,
        displayName: json.displayName,
        matchToken: json.matchToken,
        issuedAtMs: json.issuedAtMs,
      });
    },
    []
  );

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
      setPhase("connecting");
      let room;
      try {
        room = await attemptJoin(trimmedName, trimmedEmail);
      } catch (err) {
        // The room throws plain Error("Match has moved on…") on stale
        // matchId. Refetch fresh state from /api/survivor/state and retry
        // exactly once with a brand-new token before bubbling.
        const msg = err instanceof Error ? err.message.toLowerCase() : "";
        const staleToken =
          msg.includes("match has moved on") ||
          msg.includes("game server restarted");
        if (!staleToken) throw err;
        await fetch("/api/survivor/state", { cache: "no-store" })
          .then((r) => r.json())
          .then((next) => setServerState(next))
          .catch(() => undefined);
        room = await attemptJoin(trimmedName, trimmedEmail);
      }

      roomRef.current = room;
      setRoomReady(true);

      // Track the server status so the UI shows a standby panel during
      // WAITING/COUNTDOWN and only swaps to the playable canvas during
      // PLAYING. Reading from the schema can throw if the first patch
      // hasn't fully decoded yet — defensively pull primitives only.
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
          if (status === "PLAYING" || status === "ENDED") {
            setPhase("inRoom");
          } else {
            setPhase("standby");
          }
        } catch (e) {
          // First state-decoder frame can race; the next onStateChange will fix it.
          console.warn("[survivor] state read failed", e);
        }
      };
      syncFromState();
      room.onStateChange(() => syncFromState());

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
  }, [displayName, email, attemptJoin]);

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

      {phase === "standby" && roomReady && (
        <StandbyPanel
          status={roomStatus}
          countdownEndsAtMs={countdownEndsAtMs}
          alive={aliveInRoom}
          displayName={displayName}
          onLeave={leaveAndReset}
        />
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
          Mobile: left stick to move, right stick to aim (auto-fire while
          pushed). Desktop: WASD + mouse. Stay inside the safe zone — it
          shrinks. Last alive wins.
        </p>
      </form>
    </div>
  );
}

/**
 * Connected to the room but the match hasn't started yet. Shows a live
 * countdown if the server has set countdownEndsAtMs, otherwise a "waiting
 * for host" screen. Replaces the immediate canvas mount so players see a
 * clear "you're in, just waiting" state.
 */
function StandbyPanel({
  status,
  countdownEndsAtMs,
  alive,
  displayName,
  onLeave,
}: {
  status: RoomPhase;
  countdownEndsAtMs: number;
  alive: number;
  displayName: string;
  onLeave: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const remainingMs = countdownEndsAtMs > 0 ? Math.max(0, countdownEndsAtMs - now) : 0;
  const remainingS = Math.ceil(remainingMs / 1000);
  const counting = status === "COUNTDOWN" && countdownEndsAtMs > 0;

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg text-center space-y-6 border border-white/10 bg-white/[0.02] backdrop-blur-md p-8 rounded">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-fuchsia-400">
            {counting ? "Match starting" : "In lobby"}
          </p>
          <h2 className="text-2xl font-bold mt-2">
            {displayName ? `Welcome, ${displayName}.` : "You're in."}
          </h2>
          <p className="text-xs text-neutral-400 mt-2">
            {counting
              ? "Match begins automatically when the timer hits zero."
              : "Waiting for host to start. The page will switch you in automatically."}
          </p>
        </div>

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
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-fuchsia-400 animate-pulse" />
              <p className="text-sm uppercase tracking-widest text-neutral-300">
                Standby
              </p>
            </div>
          </div>
        )}

        <div className="text-xs text-neutral-400 border-t border-white/10 pt-4 space-y-1">
          <p>
            <span className="text-white">{alive}</span> / 25 player
            {alive === 1 ? "" : "s"} in the arena
          </p>
          <p className="text-[10px] text-neutral-500 leading-relaxed">
            Left stick: move · right stick: aim + fire. Desktop: WASD + mouse.
            Stay in the safe zone (it shrinks). Last alive wins.
          </p>
        </div>

        <button
          type="button"
          onClick={onLeave}
          className="text-[10px] tracking-widest uppercase text-neutral-400 hover:text-white transition-colors"
        >
          Leave lobby
        </button>
      </div>
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
