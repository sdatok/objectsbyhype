"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Client, Room } from "colyseus.js";
import type { PublicSurvivorState } from "@/lib/survivor-config";
import {
  joinSurvivorRoom,
  reconnectSurvivorRoom,
} from "@/lib/survivor-client";
import LobbyScene, { LobbyCard, LobbyPrimaryButton } from "./LobbyScene";

// Canvas needs the browser only.
const GameCanvas = dynamic(() => import("./GameCanvas"), { ssr: false });

type RoomPhase = "WAITING" | "COUNTDOWN" | "PLAYING" | "ENDED";

type Phase =
  | "lobby" // form to enter name + email
  | "joining" // POSTing /api/survivor/match-token
  | "connecting" // Colyseus joinOrCreate
  | "standby" // connected; waiting for host to start (WAITING/COUNTDOWN)
  | "inRoom" // PLAYING — GameCanvas active
  | "reconnecting" // dropped connection; trying to resume seat
  | "disconnected" // server closed our connection
  | "noMatch"; // no current match (admin hasn't started one yet)

/** Colyseus uses 4000 for intentional leave (matches server Protocol.WS_CLOSE_CONSENTED). */
const CLOSE_CONSENTED = 4000;
const RECONNECT_ATTEMPTS = 8;
const RECONNECT_BASE_MS = 400;

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
  const clientRef = useRef<Client | null>(null);
  const reconnectingRef = useRef(false);
  const credentialsRef = useRef({ displayName: "", email: "" });
  const fullRejoinRef = useRef<(() => Promise<boolean>) | null>(null);

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
        if (status === "ENDED") {
          setPhase("inRoom");
        } else if (status === "PLAYING") {
          setPhase("inRoom");
        } else {
          setPhase("standby");
        }
      } catch (e) {
        console.warn("[survivor] state read failed", e);
      }
    };
    syncFromState();
    room.onStateChange(() => syncFromState());

    room.onLeave(async (code) => {
      if (roomRef.current !== room) return;

      if (code === CLOSE_CONSENTED) {
        roomRef.current = null;
        clientRef.current = null;
        setRoomReady(false);
        return;
      }

      const token = room.reconnectionToken;
      const client = clientRef.current;
      if (!token || !client || reconnectingRef.current) {
        roomRef.current = null;
        setRoomReady(false);
        setPhase("disconnected");
        return;
      }

      reconnectingRef.current = true;
      setPhase("reconnecting");

      for (let attempt = 0; attempt < RECONNECT_ATTEMPTS; attempt++) {
        if (attempt > 0) {
          await new Promise((r) =>
            window.setTimeout(r, RECONNECT_BASE_MS * attempt)
          );
        }
        try {
          const reconnected = await reconnectSurvivorRoom(client, token);
          if (roomRef.current !== room) {
            reconnectingRef.current = false;
            return;
          }
          roomRef.current = reconnected;
          setRoomReady(true);
          attachRoom(reconnected);
          reconnectingRef.current = false;
          return;
        } catch (err) {
          console.warn("[survivor] reconnect attempt failed", attempt + 1, err);
        }
      }

      reconnectingRef.current = false;
      roomRef.current = null;
      setRoomReady(false);

      if (fullRejoinRef.current) {
        setPhase("reconnecting");
        const ok = await fullRejoinRef.current().catch(() => false);
        if (ok) return;
      }

      setPhase("disconnected");
    });

    room.onError((code, message) => {
      console.error("[survivor] room error", code, message);
      setError(message ?? "Room error");
    });
  }, []);

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

  fullRejoinRef.current = async () => {
    const { displayName: name, email: addr } = credentialsRef.current;
    if (!name || !addr) return false;
    try {
      const connection = await attemptJoin(name, addr);
      clientRef.current = connection.client;
      roomRef.current = connection.room;
      setRoomReady(true);
      attachRoom(connection.room);
      return true;
    } catch (err) {
      console.warn("[survivor] full rejoin failed", err);
      return false;
    }
  };

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
    credentialsRef.current = {
      displayName: trimmedName,
      email: trimmedEmail,
    };
    try {
      setPhase("connecting");
      let connection;
      try {
        connection = await attemptJoin(trimmedName, trimmedEmail);
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
        connection = await attemptJoin(trimmedName, trimmedEmail);
      }

      const { client, room } = connection;
      clientRef.current = client;
      roomRef.current = room;
      setRoomReady(true);
      attachRoom(room);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not join match";
      setError(message);
      setPhase("lobby");
    }
  }, [displayName, email, attemptJoin, attachRoom]);

  const leaveAndReset = useCallback(() => {
    reconnectingRef.current = false;
    const room = roomRef.current;
    if (room) {
      try {
        room.leave();
      } catch {
        /* ignore */
      }
    }
    roomRef.current = null;
    clientRef.current = null;
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

      {phase === "reconnecting" && <ReconnectingPanel />}

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
    <header className="relative z-20 w-full border-b border-fuchsia-500/25 bg-black/55 backdrop-blur-md px-6 py-4 flex items-baseline justify-between flex-wrap gap-3">
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
    <LobbyScene>
      <LobbyCard className="text-center space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-400">
          Standby
        </p>
        <h2 className="text-2xl font-bold">No match open right now.</h2>
        <p className="text-sm text-neutral-300">
          Matches are admin-started. Follow OBH on Instagram for drops, or
          keep this tab open — the lobby opens here when one starts.
        </p>
        {last && (
          <p className="text-xs text-neutral-400 mt-4 pt-4 border-t border-white/10">
            Last winner:{" "}
            <span className="text-white">{last.displayName}</span>
          </p>
        )}
      </LobbyCard>
    </LobbyScene>
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
    <LobbyScene>
      <LobbyCard>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) onJoin();
          }}
          className="space-y-5"
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
              className="w-full bg-black/70 border border-white/15 px-3 py-3 text-base text-white placeholder-neutral-600 focus:outline-none focus:border-fuchsia-500 transition-colors"
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
              className="w-full bg-black/70 border border-white/15 px-3 py-3 text-base text-white placeholder-neutral-600 focus:outline-none focus:border-fuchsia-500 transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400 break-words">{error}</p>
          )}

          <LobbyPrimaryButton type="submit" disabled={busy}>
            {phase === "joining"
              ? "Joining…"
              : phase === "connecting"
              ? "Connecting…"
              : "Enter lobby"}
          </LobbyPrimaryButton>

          <p className="text-[10px] text-neutral-500 leading-relaxed">
            Mobile: left stick to move, right stick to aim (auto-fire while
            pushed). Desktop: WASD + mouse. Stay inside the safe zone — it
            shrinks. Last alive wins.
          </p>
        </form>
      </LobbyCard>
    </LobbyScene>
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
    <LobbyScene>
      <LobbyCard className="text-center space-y-6">
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
      </LobbyCard>
    </LobbyScene>
  );
}

function DisconnectedPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <LobbyScene>
      <LobbyCard className="text-center space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-400">
          Disconnected
        </p>
        <h2 className="text-2xl font-bold">Everyone got dropped.</h2>
        <p className="text-sm text-neutral-300">
          When every player disconnects at once, the game server usually
          restarted mid-match (Railway redeploy). Tap below to rejoin if the
          round is still open — the server will sync automatically.
        </p>
        <LobbyPrimaryButton type="button" onClick={onRetry}>
          Back to lobby & rejoin
        </LobbyPrimaryButton>
      </LobbyCard>
    </LobbyScene>
  );
}

function ReconnectingPanel() {
  return (
    <LobbyScene>
      <LobbyCard className="text-center space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-400">
          Reconnecting
        </p>
        <h2 className="text-2xl font-bold">Hold on — getting you back in.</h2>
        <p className="text-sm text-neutral-300">
          Connection blipped. We&apos;re rejoining your seat automatically.
        </p>
        <div className="flex items-center justify-center gap-2 pt-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-fuchsia-400 animate-pulse" />
          <span className="text-[10px] uppercase tracking-widest text-neutral-400">
            Trying to reconnect…
          </span>
        </div>
      </LobbyCard>
    </LobbyScene>
  );
}
