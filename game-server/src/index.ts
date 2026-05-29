import { createServer } from "http";
import express, { type Request, type Response } from "express";
import { Server, matchMaker } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { SurvivorRoom } from "./SurvivorRoom";
import {
  verifyAdminCommand,
  type AdminCommand,
  ADMIN_COMMAND_TTL_MS,
} from "./hmac";
import {
  DEFAULT_MATCH_SECONDS,
  DEFAULT_LOBBY_SECONDS,
  MIN_LOBBY_SECONDS,
  MAX_LOBBY_SECONDS,
  MIN_MATCH_SECONDS,
  MAX_MATCH_SECONDS,
  MAX_PLAYERS,
} from "./constants";

const ROOM_NAME = "survivor";

const app = express();
app.use(express.json({ limit: "32kb" }));

// CORS for the matchmaker HTTP call (Colyseus does a POST to /matchmake/...
// before upgrading to WSS). ALLOWED_ORIGIN can be a single origin, a
// comma-separated list, or "*" for permissive dev. We echo the matched
// origin back instead of "*" so credentials (and a fixed ACAO) work.
const allowedOriginsRaw = process.env.ALLOWED_ORIGIN ?? "*";
const allowedOrigins = allowedOriginsRaw
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const allowAny = allowedOrigins.length === 0 || allowedOrigins.includes("*");

app.use((req, res, next) => {
  const requestOrigin = req.header("origin") ?? "";
  let echo = "";
  if (allowAny) {
    echo = requestOrigin || "*";
  } else if (allowedOrigins.includes(requestOrigin)) {
    echo = requestOrigin;
  }
  if (echo) {
    res.setHeader("Access-Control-Allow-Origin", echo);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type,X-Admin-Signature,X-Admin-Issued-At"
  );
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

const httpServer = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define(ROOM_NAME, SurvivorRoom);

// ---------- Liveness ----------

app.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    ts: Date.now(),
    service: "objectsbyhype-survivor",
    gitSha: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? "unknown",
    build: "island-v9.5",
    features: ["obstacles", "island-maze", "zone-shrink", "mobile-sticks", "gorilla-flower", "reconnect", "sprite-key", "vendor-towers", "slime-avatars", "rocket-aoe", "flamethrower", "ice-bow", "schema-fix"],
  });
});

app.get("/version", (_req, res) => {
  res.json({
    ok: true,
    build: "island-v9.5",
    gitSha: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? "unknown",
  });
});

// ---------- Helpers ----------

async function getRoom(): Promise<SurvivorRoom | null> {
  // Discover an existing instance. We seed one lazily on first /admin/start
  // if none exists.
  const rooms = await matchMaker.query({ name: ROOM_NAME });
  if (rooms.length === 0) return null;
  const ref = rooms[0];
  const local = matchMaker.getLocalRoomById(ref.roomId) as
    | SurvivorRoom
    | undefined;
  return local ?? null;
}

async function ensureRoom(): Promise<SurvivorRoom> {
  let room = await getRoom();
  if (room) return room;
  await matchMaker.createRoom(ROOM_NAME, {});
  room = await getRoom();
  if (!room) throw new Error("Could not create SurvivorRoom");
  return room;
}

function parseAdminAuth(
  req: Request,
  command: AdminCommand,
  matchId: string
): { ok: true } | { ok: false; status: number; error: string } {
  const sig = String(req.header("x-admin-signature") ?? "");
  const issuedAtMs = Number(req.header("x-admin-issued-at"));
  if (!sig || !Number.isFinite(issuedAtMs)) {
    return { ok: false, status: 400, error: "Missing admin signature" };
  }
  if (!verifyAdminCommand({ command, matchId, issuedAtMs }, sig)) {
    return { ok: false, status: 401, error: "Bad signature" };
  }
  return { ok: true };
}

// ---------- Admin endpoints ----------

app.post("/admin/start", async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const matchId = String(body.matchId ?? "");
    const prizeTitle = String(body.prizeTitle ?? "OBH Survivor Prize");
    const matchSeconds = Math.max(
      MIN_MATCH_SECONDS,
      Math.min(MAX_MATCH_SECONDS, Number(body.matchSeconds) || DEFAULT_MATCH_SECONDS)
    );
    const lobbySeconds = Math.max(
      MIN_LOBBY_SECONDS,
      Math.min(MAX_LOBBY_SECONDS, Number(body.lobbySeconds) || DEFAULT_LOBBY_SECONDS)
    );
    if (!matchId) {
      res.status(400).json({ error: "matchId required" });
      return;
    }
    const auth = parseAdminAuth(req, "start", matchId);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    const room = await ensureRoom();
    try {
      room.startMatch(matchId, prizeTitle, matchSeconds, lobbySeconds);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not start match";
      res.status(409).json({ error: message });
      return;
    }
    res.json({
      ok: true,
      matchId,
      matchSeconds,
      lobbySeconds,
    });
  } catch (err) {
    console.error("[/admin/start]", err);
    res.status(500).json({ error: "internal error" });
  }
});

/**
 * Re-bind: valid after a Railway restart wiped in-memory state, or when the
 * room lost track of the current matchId. Restores PLAYING when timing fields
 * are supplied so mid-match crashes don't force a fresh lobby countdown.
 */
app.post("/admin/rebind", async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const matchId = String(body.matchId ?? "");
    const prizeTitle = String(body.prizeTitle ?? "OBH Survivor Prize");
    const matchSeconds = Math.max(
      MIN_MATCH_SECONDS,
      Math.min(MAX_MATCH_SECONDS, Number(body.matchSeconds) || DEFAULT_MATCH_SECONDS)
    );
    const lobbySeconds = Math.max(
      MIN_LOBBY_SECONDS,
      Math.min(MAX_LOBBY_SECONDS, Number(body.lobbySeconds) || DEFAULT_LOBBY_SECONDS)
    );
    const targetStatus = String(body.targetStatus ?? "COUNTDOWN") as
      | "WAITING"
      | "COUNTDOWN"
      | "PLAYING";
    const startedAtMs = Number(body.startedAtMs) || 0;
    const matchEndsAtMs = Number(body.matchEndsAtMs) || 0;
    if (!matchId) {
      res.status(400).json({ error: "matchId required" });
      return;
    }
    const auth = parseAdminAuth(req, "start", matchId);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    const room = await ensureRoom();
    if (
      room.state.matchId &&
      room.state.matchId !== matchId &&
      (room.state.status === "PLAYING" || room.state.status === "COUNTDOWN")
    ) {
      res.status(409).json({
        error: "Room already has an active match",
        currentMatchId: room.state.matchId,
        status: room.state.status,
      });
      return;
    }
    room.restoreMatch(
      matchId,
      prizeTitle,
      matchSeconds,
      lobbySeconds,
      targetStatus,
      startedAtMs,
      matchEndsAtMs
    );
    res.json({ ok: true, rebound: true, matchId, targetStatus });
  } catch (err) {
    console.error("[/admin/rebind]", err);
    res.status(500).json({ error: "internal error" });
  }
});

app.post("/admin/end", async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const matchId = String(body.matchId ?? "");
    if (!matchId) {
      res.status(400).json({ error: "matchId required" });
      return;
    }
    const auth = parseAdminAuth(req, "end", matchId);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    const room = await getRoom();
    if (!room) {
      res.json({ ok: true, note: "no room" });
      return;
    }
    if (room.state.matchId !== matchId) {
      res.json({ ok: true, note: "match already ended" });
      return;
    }
    room.endMatch("admin");
    res.json({ ok: true });
  } catch (err) {
    console.error("[/admin/end]", err);
    res.status(500).json({ error: "internal error" });
  }
});

app.get("/admin/state", async (req: Request, res: Response) => {
  // Read-only debug snapshot; doesn't change anything so a static shared
  // secret check is enough here.
  const provided = req.header("x-admin-secret") ?? "";
  if (!process.env.SURVIVOR_SECRET || provided !== process.env.SURVIVOR_SECRET) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const room = await getRoom();
  res.json({
    ok: true,
    room: room ? room.adminSnapshot() : null,
    maxPlayers: MAX_PLAYERS,
  });
});

// ---------- Boot ----------

const port = Number(process.env.PORT) || 2567;
gameServer.listen(port).then(() => {
  console.log(`[survivor] listening on :${port}`);
  console.log(
    `[survivor] admin command TTL=${ADMIN_COMMAND_TTL_MS}ms, allowed origins=${allowedOriginsRaw}${allowAny ? " (permissive)" : ""}`
  );
});

process.on("SIGTERM", () => {
  console.log("[survivor] SIGTERM");
  gameServer.gracefullyShutdown().then(() => process.exit(0));
});
process.on("SIGINT", () => {
  console.log("[survivor] SIGINT");
  gameServer.gracefullyShutdown().then(() => process.exit(0));
});
