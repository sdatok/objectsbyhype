"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import type { Client, Room } from "colyseus.js";
import {
  type PublicSurvivorState,
  SURVIVOR_MAX_PLAYERS,
} from "@/lib/survivor-config";
import {
  clearSurvivorReconnectSession,
  joinSurvivorRoom,
  readSurvivorReconnectSession,
  reconnectSurvivorRoom,
  saveSurvivorReconnectSession,
} from "@/lib/survivor-client";
import LobbyScene, { LobbyCard, LobbyPrimaryButton } from "./LobbyScene";
import { SurvivorMusicProvider } from "./SurvivorMusic";
import SlimeAvatar from "./SlimeAvatar";
import {
  DEFAULT_NAME_COLOR,
  DEFAULT_SLIME_COLOR,
  loadSlimeCustomizationFromStorage,
  NAME_BADGES,
  NAME_COLORS,
  NAME_OUTLINES,
  saveSlimeCustomizationToStorage,
  SLIME_BODY_ACCESSORIES,
  SLIME_COLORS,
  SLIME_FACE_LABELS,
  SLIME_HEAD_ACCESSORIES,
  type NameColor,
  type SlimeColor,
} from "@/lib/survivor-slime";

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
  const [slimeColor, setSlimeColor] = useState<SlimeColor>(DEFAULT_SLIME_COLOR);
  const [slimeFace, setSlimeFace] = useState(0);
  const [slimeHeadAccessory, setSlimeHeadAccessory] = useState(0);
  const [slimeBodyAccessory, setSlimeBodyAccessory] = useState(0);
  const [nameColor, setNameColor] = useState<NameColor>(DEFAULT_NAME_COLOR);
  const [nameOutline, setNameOutline] = useState(0);
  const [nameBadge, setNameBadge] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [roomReady, setRoomReady] = useState(false);
  const [roomStatus, setRoomStatus] = useState<RoomPhase>("WAITING");
  const [countdownEndsAtMs, setCountdownEndsAtMs] = useState<number>(0);
  const [aliveInRoom, setAliveInRoom] = useState<number>(0);
  const roomRef = useRef<Room | null>(null);
  const clientRef = useRef<Client | null>(null);
  const reconnectingRef = useRef(false);
  const autoResumeAttemptedRef = useRef(false);
  const credentialsRef = useRef({ displayName: "", email: "" });
  const wsUrlRef = useRef("");

  const persistReconnectSession = useCallback((room: Room) => {
    const token = room.reconnectionToken;
    const matchId = String(
      (room.state as unknown as { matchId?: string })?.matchId ?? ""
    );
    const wsUrl = wsUrlRef.current;
    const { displayName: name, email: addr } = credentialsRef.current;
    if (!token || !matchId || !wsUrl || !addr) return;
    saveSurvivorReconnectSession({
      wsUrl,
      matchId,
      email: addr,
      displayName: name,
      reconnectionToken: token,
      savedAtMs: Date.now(),
    });
  }, []);

  // Restore previously-used name/email so returning visitors don't retype.
  useEffect(() => {
    try {
      setDisplayName(localStorage.getItem(NAME_KEY) ?? "");
      setEmail(localStorage.getItem(EMAIL_KEY) ?? "");
      const saved = loadSlimeCustomizationFromStorage();
      setSlimeColor(saved.slimeColor);
      setSlimeFace(saved.slimeFace);
      setSlimeHeadAccessory(saved.slimeHeadAccessory);
      setSlimeBodyAccessory(saved.slimeBodyAccessory);
      setNameColor(saved.nameColor);
      setNameOutline(saved.nameOutline);
      setNameBadge(saved.nameBadge);
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
          clearSurvivorReconnectSession();
          setPhase("inRoom");
        } else if (status === "PLAYING") {
          setPhase("inRoom");
        } else {
          setPhase("standby");
        }
        persistReconnectSession(room);
      } catch (e) {
        console.warn("[survivor] state read failed", e);
      }
    };
    syncFromState();
    room.onStateChange(() => syncFromState());
    persistReconnectSession(room);

    room.onLeave(async (code) => {
      if (roomRef.current !== room) return;

      if (code === CLOSE_CONSENTED) {
        roomRef.current = null;
        clientRef.current = null;
        setRoomReady(false);
        clearSurvivorReconnectSession();
        return;
      }

      const token = room.reconnectionToken;
      const client = clientRef.current;
      if (!token || !client || reconnectingRef.current) {
        roomRef.current = null;
        setRoomReady(false);
        clearSurvivorReconnectSession();
        setPhase("disconnected");
        setError("Connection lost. You can't rejoin a live match from the lobby.");
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
      clearSurvivorReconnectSession();
      setPhase("disconnected");
      setError("Reconnect failed. Wait for the next match.");
    });

    room.onError((code, message) => {
      console.error("[survivor] room error", code, message);
      setError(message ?? "Room error");
    });
  }, [persistReconnectSession]);

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
        slimeColor,
        slimeFace,
        slimeHeadAccessory,
        slimeBodyAccessory,
        nameColor,
        nameOutline,
        nameBadge,
      }).then((connection) => {
        wsUrlRef.current = json.wsUrl as string;
        return connection;
      });
    },
    [slimeColor, slimeFace, slimeHeadAccessory, slimeBodyAccessory, nameColor, nameOutline, nameBadge]
  );

  const join = useCallback(async () => {
    setError(null);
    const trimmedName = displayName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName || !trimmedEmail) {
      setError("Display name and email are required.");
      return;
    }
    const matchStatus = serverState.currentMatch?.status;
    if (matchStatus === "PLAYING") {
      setError(
        "Match already in progress. If you disconnected, reload to reconnect — you can't join fresh."
      );
      return;
    }
    if (matchStatus === "ENDED") {
      setError("This match has ended. Wait for the next one.");
      return;
    }
    try {
      localStorage.setItem(NAME_KEY, trimmedName);
      localStorage.setItem(EMAIL_KEY, trimmedEmail);
      saveSlimeCustomizationToStorage({
        slimeColor,
        slimeFace,
        slimeHeadAccessory,
        slimeBodyAccessory,
        nameColor,
        nameOutline,
        nameBadge,
      });
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
  }, [
    displayName,
    email,
    slimeColor,
    slimeFace,
    slimeHeadAccessory,
    slimeBodyAccessory,
    nameColor,
    nameOutline,
    nameBadge,
    serverState.currentMatch?.status,
    attemptJoin,
    attachRoom,
  ]);

  // After a page refresh mid-match, try Colyseus reconnect before showing lobby.
  useEffect(() => {
    if (autoResumeAttemptedRef.current) return;
    if (phase !== "lobby" && phase !== "noMatch") return;

    const saved = readSurvivorReconnectSession();
    const match = serverState.currentMatch;
    if (!saved || !match || saved.matchId !== match.id) return;
    if (match.status === "ENDED") {
      clearSurvivorReconnectSession();
      return;
    }

    autoResumeAttemptedRef.current = true;
    credentialsRef.current = {
      displayName: saved.displayName,
      email: saved.email,
    };
    wsUrlRef.current = saved.wsUrl;
    setDisplayName(saved.displayName);
    setEmail(saved.email);
    setPhase("reconnecting");

    let cancelled = false;
    (async () => {
      try {
        const { Client } = await import("colyseus.js");
        const client = new Client(saved.wsUrl);
        const room = await reconnectSurvivorRoom(client, saved.reconnectionToken);
        if (cancelled) return;
        clientRef.current = client;
        roomRef.current = room;
        setRoomReady(true);
        attachRoom(room);
      } catch (err) {
        if (cancelled) return;
        console.warn("[survivor] auto-resume failed", err);
        clearSurvivorReconnectSession();
        setPhase("lobby");
        setError("Reconnect expired — wait for the next match.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, serverState.currentMatch, attachRoom]);

  const leaveAndReset = useCallback(() => {
    reconnectingRef.current = false;
    clearSurvivorReconnectSession();
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
    <SurvivorMusicProvider>
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <Header serverState={serverState} />

      {phase === "noMatch" && <NoMatchPanel last={serverState.lastWinner} />}

      {(phase === "lobby" || phase === "joining" || phase === "connecting") && (
        <LobbyPanel
          serverState={serverState}
          displayName={displayName}
          email={email}
          slimeColor={slimeColor}
          slimeFace={slimeFace}
          slimeHeadAccessory={slimeHeadAccessory}
          slimeBodyAccessory={slimeBodyAccessory}
          nameColor={nameColor}
          nameOutline={nameOutline}
          nameBadge={nameBadge}
          onName={setDisplayName}
          onEmail={setEmail}
          onSlimeColor={setSlimeColor}
          onSlimeFace={setSlimeFace}
          onSlimeHeadAccessory={setSlimeHeadAccessory}
          onSlimeBodyAccessory={setSlimeBodyAccessory}
          onNameColor={setNameColor}
          onNameOutline={setNameOutline}
          onNameBadge={setNameBadge}
          onJoin={join}
          phase={phase}
          error={error}
        />
      )}

      {phase === "disconnected" && (
        <DisconnectedPanel onRetry={leaveAndReset} />
      )}

      {phase === "reconnecting" && !(roomReady && roomRef.current) && (
        <ReconnectingPanel />
      )}

      {(phase === "inRoom" || phase === "reconnecting") &&
        roomReady &&
        roomRef.current && (
          <div className="flex-1 flex flex-col relative min-h-0">
            <GameCanvas room={roomRef.current} onLeave={leaveAndReset} />
            {phase === "reconnecting" && <ReconnectingBanner />}
          </div>
        )}

      {phase === "standby" && roomReady && (
        <StandbyPanel
          status={roomStatus}
          countdownEndsAtMs={countdownEndsAtMs}
          alive={aliveInRoom}
          displayName={displayName}
          slimeColor={slimeColor}
          slimeFace={slimeFace}
          slimeHeadAccessory={slimeHeadAccessory}
          slimeBodyAccessory={slimeBodyAccessory}
          nameColor={nameColor}
          nameOutline={nameOutline}
          nameBadge={nameBadge}
          onLeave={leaveAndReset}
        />
      )}
      </main>
    </SurvivorMusicProvider>
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
        {SURVIVOR_MAX_PLAYERS} players · last alive wins
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
  slimeColor: SlimeColor;
  slimeFace: number;
  slimeHeadAccessory: number;
  slimeBodyAccessory: number;
  nameColor: NameColor;
  nameOutline: number;
  nameBadge: number;
  onName: (v: string) => void;
  onEmail: (v: string) => void;
  onSlimeColor: (v: SlimeColor) => void;
  onSlimeFace: (v: number) => void;
  onSlimeHeadAccessory: (v: number) => void;
  onSlimeBodyAccessory: (v: number) => void;
  onNameColor: (v: NameColor) => void;
  onNameOutline: (v: number) => void;
  onNameBadge: (v: number) => void;
  onJoin: () => void;
  phase: Phase;
  error: string | null;
}) {
  const {
    serverState,
    displayName,
    email,
    slimeColor,
    slimeFace,
    slimeHeadAccessory,
    slimeBodyAccessory,
    nameColor,
    nameOutline,
    nameBadge,
    onName,
    onEmail,
    onSlimeColor,
    onSlimeFace,
    onSlimeHeadAccessory,
    onSlimeBodyAccessory,
    onNameColor,
    onNameOutline,
    onNameBadge,
    onJoin,
    phase,
    error,
  } = props;
  const badgeGlyph =
    NAME_BADGES.find((b) => b.id === nameBadge)?.glyph ?? "";
  const nameTagStyle: CSSProperties = {
    color: nameColor,
    textShadow:
      nameOutline === 1
        ? "0 0 8px rgba(255,255,255,0.95), 0 0 16px rgba(255,255,255,0.45)"
        : undefined,
    WebkitTextStroke:
      nameOutline === 2 ? "1px rgba(0,0,0,0.95)" : undefined,
  };
  const busy = phase === "joining" || phase === "connecting";
  const status = serverState.currentMatch?.status;
  const matchLive = status === "PLAYING";
  const matchClosed = status === "ENDED";
  const joinBlocked = matchLive || matchClosed;
  const participantCount = serverState.currentMatch?.participantCount ?? 0;

  return (
    <LobbyScene>
      <LobbyCard>
          <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy && !joinBlocked) onJoin();
          }}
          className="space-y-5"
        >
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-fuchsia-400">
              Lobby {status ? `· ${status.toLowerCase()}` : ""}
            </p>
            <h2 className="text-xl font-bold mt-2">Join the arena</h2>
            <p className="text-xs text-neutral-400 mt-1">
              {matchLive
                ? "Match is live — reload this page to reconnect if you were in it."
                : matchClosed
                ? "This match has ended. Wait for the next drop."
                : `${participantCount} ${participantCount === 1 ? "player" : "players"} queued. Match begins when the host starts it.`}
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
              style={{ color: nameColor }}
            />
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2">
                Name tag colour
              </p>
              <div className="flex flex-wrap gap-2">
                {NAME_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-label={`Name colour ${c.label}`}
                    onClick={() => onNameColor(c.id)}
                    className={`h-7 w-7 border-2 transition-transform ${
                      nameColor === c.id
                        ? "border-white scale-110"
                        : "border-white/20 hover:border-white/50"
                    }`}
                    style={{ backgroundColor: c.id }}
                  />
                ))}
              </div>
            </div>
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2">
                  Name outline
                </p>
                <div className="flex flex-wrap gap-2">
                  {NAME_OUTLINES.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => onNameOutline(o.id)}
                      className={`px-3 py-1.5 text-[10px] uppercase tracking-widest border ${
                        nameOutline === o.id
                          ? "border-fuchsia-400 text-white bg-fuchsia-500/20"
                          : "border-white/15 text-neutral-400 hover:border-white/40"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2">
                  Name badge
                </p>
                <div className="flex flex-wrap gap-2">
                  {NAME_BADGES.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => onNameBadge(b.id)}
                      className={`px-3 py-1.5 text-[10px] uppercase tracking-widest border ${
                        nameBadge === b.id
                          ? "border-fuchsia-400 text-white bg-fuchsia-500/20"
                          : "border-white/15 text-neutral-400 hover:border-white/40"
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
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

          <div className="border border-white/10 bg-black/40 p-4 space-y-4">
            <div className="flex items-center gap-4">
              <SlimeAvatar
                color={slimeColor}
                face={slimeFace}
                headAccessory={slimeHeadAccessory}
                bodyAccessory={slimeBodyAccessory}
                size={88}
              />
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-fuchsia-300">
                  Your slime
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  Face, head gear, body drip — then drop in.
                </p>
                {displayName && (
                  <p
                    className="text-sm font-bold tracking-widest uppercase mt-2 inline-flex items-center gap-1.5"
                    style={nameTagStyle}
                  >
                    {badgeGlyph ? (
                      <span aria-hidden className="text-base leading-none">
                        {badgeGlyph}
                      </span>
                    ) : null}
                    {displayName}
                  </p>
                )}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2">
                Colour
              </p>
              <div className="grid grid-cols-6 gap-2">
                {SLIME_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Slime colour ${c}`}
                    onClick={() => onSlimeColor(c)}
                    className={`h-8 w-full border-2 transition-transform ${
                      slimeColor === c
                        ? "border-white scale-105"
                        : "border-white/20 hover:border-white/50"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2">
                Face
              </p>
              <div className="flex flex-wrap gap-2">
                {SLIME_FACE_LABELS.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onSlimeFace(i)}
                    className={`px-3 py-1.5 text-[10px] uppercase tracking-widest border ${
                      slimeFace === i
                        ? "border-fuchsia-400 text-white bg-fuchsia-500/20"
                        : "border-white/15 text-neutral-400 hover:border-white/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2">
                Head slot
              </p>
              <div className="flex flex-wrap gap-2">
                {SLIME_HEAD_ACCESSORIES.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onSlimeHeadAccessory(a.id)}
                    className={`px-3 py-1.5 text-[10px] uppercase tracking-widest border ${
                      slimeHeadAccessory === a.id
                        ? "border-fuchsia-400 text-white bg-fuchsia-500/20"
                        : "border-white/15 text-neutral-400 hover:border-white/40"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2">
                Body slot
              </p>
              <div className="flex flex-wrap gap-2">
                {SLIME_BODY_ACCESSORIES.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onSlimeBodyAccessory(a.id)}
                    className={`px-3 py-1.5 text-[10px] uppercase tracking-widest border ${
                      slimeBodyAccessory === a.id
                        ? "border-fuchsia-400 text-white bg-fuchsia-500/20"
                        : "border-white/15 text-neutral-400 hover:border-white/40"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-400 break-words">{error}</p>
          )}

          <LobbyPrimaryButton type="submit" disabled={busy || joinBlocked}>
            {phase === "joining"
              ? "Joining…"
              : phase === "connecting"
              ? "Connecting…"
              : matchLive
              ? "Match in progress"
              : matchClosed
              ? "Match ended"
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
  slimeColor,
  slimeFace,
  slimeHeadAccessory,
  slimeBodyAccessory,
  nameColor,
  nameOutline,
  nameBadge,
  onLeave,
}: {
  status: RoomPhase;
  countdownEndsAtMs: number;
  alive: number;
  displayName: string;
  slimeColor: SlimeColor;
  slimeFace: number;
  slimeHeadAccessory: number;
  slimeBodyAccessory: number;
  nameColor: NameColor;
  nameOutline: number;
  nameBadge: number;
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
  const badgeGlyph =
    NAME_BADGES.find((b) => b.id === nameBadge)?.glyph ?? "";
  const nameTagStyle: CSSProperties = {
    color: nameColor,
    textShadow:
      nameOutline === 1
        ? "0 0 8px rgba(255,255,255,0.95), 0 0 16px rgba(255,255,255,0.45)"
        : undefined,
    WebkitTextStroke:
      nameOutline === 2 ? "1px rgba(0,0,0,0.95)" : undefined,
  };

  return (
    <LobbyScene>
      <LobbyCard className="text-center space-y-6">
        <div className="flex flex-col items-center gap-3">
          <SlimeAvatar
            color={slimeColor}
            face={slimeFace}
            headAccessory={slimeHeadAccessory}
            bodyAccessory={slimeBodyAccessory}
            size={112}
          />
          <h2
            className="text-2xl font-bold mt-1 tracking-widest uppercase inline-flex items-center gap-2"
            style={nameTagStyle}
          >
            {badgeGlyph ? (
              <span aria-hidden className="text-xl leading-none">
                {badgeGlyph}
              </span>
            ) : null}
            {displayName ? displayName : "You're in."}
          </h2>
        </div>

        <p className="text-[10px] uppercase tracking-[0.3em] text-fuchsia-400">
          {counting ? "Match starting" : "In lobby"}
        </p>

        <p className="text-xs text-neutral-400">
          {counting
            ? "Match begins automatically when the timer hits zero."
            : "Waiting for host to start. The page will switch you in automatically."}
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
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-fuchsia-400 animate-pulse" />
              <p className="text-sm uppercase tracking-widest text-neutral-300">
                Standby
              </p>
            </div>
          </div>
        )}

        <div className="text-xs text-neutral-400 border-t border-white/10 pt-4 space-y-1">
          <p>
            <span className="text-white">{alive}</span> / {SURVIVOR_MAX_PLAYERS} player
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

function ReconnectingBanner() {
  return (
    <div className="absolute top-4 inset-x-0 flex justify-center z-40 pointer-events-none px-4">
      <div className="border border-fuchsia-400/40 bg-black/80 backdrop-blur-sm px-4 py-2 text-center max-w-md">
        <p className="text-[10px] uppercase tracking-[0.3em] text-fuchsia-300">
          Reconnecting
        </p>
        <p className="text-xs text-neutral-200 mt-1">
          Connection blipped — rejoining your seat. Keep watching; ghost roam
          still works.
        </p>
      </div>
    </div>
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
