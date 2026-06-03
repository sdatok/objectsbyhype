# objectsbyhype-survivor-server

Authoritative Colyseus game server for the `/survivor` 50-player top-down shooter on objectsbyhype.com.

Deployed separately from the Next.js storefront (which runs on Vercel) because Vercel Functions can't host a persistent WebSocket process. This server runs on **Railway** (Hobby tier is sufficient for one 50-player room).

## What it does

- Hosts ONE Colyseus room (`survivor`) that holds the live match state in memory
- Runs the authoritative game loop at 30 Hz (player movement, bullets, shrinking zone)
- Authenticates joining clients via an HMAC `matchToken` issued by Next.js
- Exposes a small Express admin API (`/admin/start`, `/admin/end`, `/admin/state`, `/healthz`)
- POSTs final placements + kills back to Next.js (`WEBHOOK_URL`) for DB persistence

## Local dev

```bash
cd game-server
cp .env.example .env       # fill SURVIVOR_SECRET to match Next.js
npm install
npm run dev                # starts on :2567 by default
```

Make sure `NEXT_PUBLIC_SURVIVOR_WS_URL=ws://localhost:2567` in the Next.js `.env.local`. Both sides need the same `SURVIVOR_SECRET`.

## Railway deployment

1. New Railway service → "Deploy from GitHub repo" → pick this repo.
2. Service settings → **Root directory** = `game-server`.
3. **Build command**: `npm install && npm run build`
4. **Start command**: `npm run start`
5. Add env vars in Railway:
   - `SURVIVOR_SECRET` = same value as Vercel's
   - `WEBHOOK_URL` = `https://objectsbyhype.com/api/admin/survivor/result`
   - `ALLOWED_ORIGIN` = `https://objectsbyhype.com` (optional but recommended)
6. After it deploys, the public URL is `https://<service>.up.railway.app`. Set the Vercel env vars:
   - `NEXT_PUBLIC_SURVIVOR_WS_URL` = `wss://<service>.up.railway.app`
   - `SURVIVOR_GAME_SERVER_URL` = `https://<service>.up.railway.app`
7. Optional: point `survivor.objectsbyhype.com` at the Railway service via CNAME and update the env URLs.

## Architecture quick-reference

```
Browser  ──HTTP──▶  Vercel (Next.js)  ──HMAC POST──▶  Railway (this server)
Browser  ────────WSS────────▶  Railway (this server)
Railway  ──HMAC POST──▶  Vercel /api/admin/survivor/result  ──▶  Neon Postgres
```

All admin actions and the result webhook are HMAC-signed with `SURVIVOR_SECRET` so nothing trusts the network in between.
