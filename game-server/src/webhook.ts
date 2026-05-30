import { signResultWebhook, sha256Hex } from "./hmac";

/**
 * POSTs the finished match payload back to the Next.js admin webhook so it
 * can be persisted to Postgres. The Next.js side verifies our HMAC before
 * trusting any of these numbers.
 */

export interface ResultParticipant {
  email: string;
  displayName: string;
  placement: number;
  kills: number;
  survivedSeconds: number;
}

export interface ResultPayload {
  matchId: string;
  startedAt: string;
  endedAt: string;
  winnerEmail: string | null;
  participants: ResultParticipant[];
}

export async function postMatchResult(payload: ResultPayload): Promise<void> {
  await postResultToUrl(process.env.WEBHOOK_URL, payload);
}

export async function postLunaMatchResult(payload: ResultPayload): Promise<void> {
  const url =
    process.env.LUNA_WEBHOOK_URL ??
    process.env.WEBHOOK_URL?.replace("/survivor/result", "/luna/result");
  await postResultToUrl(url, payload);
}

async function postResultToUrl(
  webhookUrl: string | undefined,
  payload: ResultPayload
): Promise<void> {
  if (!webhookUrl) {
    console.warn("[webhook] webhook URL not set; skipping match result POST");
    return;
  }

  const rawBody = JSON.stringify(payload);
  const issuedAtMs = Date.now();
  const signature = signResultWebhook(
    { matchId: payload.matchId, issuedAtMs },
    sha256Hex(rawBody)
  );

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Survivor-Match-Id": payload.matchId,
        "X-Survivor-Issued-At": String(issuedAtMs),
        "X-Survivor-Signature": signature,
      },
      body: rawBody,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[webhook] POST ${webhookUrl} failed: ${res.status} ${text.slice(0, 200)}`
      );
    } else {
      console.log(`[webhook] match ${payload.matchId} result posted`);
    }
  } catch (err) {
    console.error("[webhook] POST failed", err);
  }
}
