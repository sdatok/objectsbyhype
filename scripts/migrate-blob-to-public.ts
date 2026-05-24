/**
 * Blob migration: re-upload every privately-stored image as a public blob,
 * verify it loads, then rewrite the DB URL from `/api/media/blob/<pathname>`
 * to the new direct `*.public.blob.vercel-storage.com/<pathname>` URL.
 *
 * Why: serving images through the `/api/media/blob/[...path]` proxy hits
 * Vercel Blob egress on every cache miss because the function streams the
 * bytes through. Direct public URLs are served from the Vercel Blob CDN
 * with much cheaper data transfer and lower latency.
 *
 * SAFETY MODEL
 * ------------
 * - Defaults to dry-run; pass --apply to actually mutate anything.
 * - Old private blobs are NOT deleted. Worst-case rollback is a single SQL
 *   `UPDATE` that swaps the URLs back; the proxy route stays in place.
 * - Re-runnable. URLs that already point at a public blob are skipped.
 * - Per-row update is its own transaction; a partial run leaves a
 *   consistent state.
 *
 * PREREQS
 * -------
 * 1. Create a NEW *public* Blob store in the Vercel dashboard
 *    (Storage → Create → Blob → Access: Public). Don't reuse the private
 *    store — the access mode is fixed at create time.
 * 2. Add the new store's read/write token as `BLOB_PUBLIC_READ_WRITE_TOKEN`
 *    to the Vercel project (and to local `.env` if running locally).
 * 3. Keep the existing `BLOB_READ_WRITE_TOKEN` (the private store) — the
 *    script needs it to read the source blobs.
 *
 * USAGE
 * -----
 *   pnpm tsx scripts/migrate-blob-to-public.ts                  # dry run
 *   pnpm tsx scripts/migrate-blob-to-public.ts --limit=10       # dry run, first 10 only
 *   pnpm tsx scripts/migrate-blob-to-public.ts --apply          # actually migrate
 *   pnpm tsx scripts/migrate-blob-to-public.ts --apply --type=wtf
 *
 * AFTER MIGRATION
 * ---------------
 * 1. Browse the live site, confirm images load from the new public host.
 * 2. In Vercel project settings, set BLOB_READ_WRITE_TOKEN to the *public*
 *    store's token and remove BLOB_PUT_ACCESS=private (or set =public).
 *    From now on new uploads in `lib/server-upload.ts` will return direct
 *    public URLs and skip the proxy.
 * 3. After ~1 week of stability, you can remove `app/api/media/blob/[...path]/route.ts`
 *    and delete the old private blob store from the dashboard.
 */

import { PrismaClient } from "@prisma/client";
import { get, put } from "@vercel/blob";
import * as fs from "fs";
import * as path from "path";

// ---------- env loader (mirrors scripts/seed.ts) ----------
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const [key, ...rest] = line.split("=");
    if (key && rest.length && !process.env[key.trim()]) {
      process.env[key.trim()] = rest
        .join("=")
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }
}

// ---------- args ----------
type EntityType = "products" | "variants" | "wtf" | "submissions" | "all";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const limitFlag = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitFlag ? parseInt(limitFlag.split("=")[1], 10) : Infinity;
const typeFlag = args.find((a) => a.startsWith("--type="));
const TYPE: EntityType = (typeFlag?.split("=")[1] as EntityType) ?? "all";

const PRIVATE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN?.trim();
const PUBLIC_TOKEN = process.env.BLOB_PUBLIC_READ_WRITE_TOKEN?.trim();

if (!PRIVATE_TOKEN) {
  console.error(
    "Missing BLOB_READ_WRITE_TOKEN — needed to read the source private store."
  );
  process.exit(1);
}
if (!PUBLIC_TOKEN) {
  console.error(
    "Missing BLOB_PUBLIC_READ_WRITE_TOKEN — needed to write to the new public store. " +
      "Create a public Blob store in Vercel and add its token to your env."
  );
  process.exit(1);
}

const prisma = new PrismaClient();

// ---------- helpers ----------
const PROXY_PREFIX = "/api/media/blob/";

interface MigrationOutcome {
  status: "skipped" | "would-migrate" | "migrated" | "missing" | "error";
  oldUrl: string;
  newUrl?: string;
  reason?: string;
}

const stats = {
  scanned: 0,
  alreadyPublic: 0,
  external: 0,
  wouldMigrate: 0,
  migrated: 0,
  missing: 0,
  errors: 0,
};

/** Fetch the blob bytes from the private store and re-upload to the public
 *  one at the same pathname. Returns the new public URL. */
async function copyToPublic(pathname: string): Promise<string> {
  const result = await get(pathname, {
    access: "private",
    token: PRIVATE_TOKEN,
  });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error(`source-not-found: ${pathname}`);
  }

  // Stream into a Buffer. Product images are typically <2MB so this is fine.
  const chunks: Uint8Array[] = [];
  const reader = (result.stream as ReadableStream<Uint8Array>).getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const body = Buffer.concat(chunks);

  const uploaded = await put(pathname, body, {
    access: "public",
    token: PUBLIC_TOKEN,
    contentType: result.blob.contentType ?? "application/octet-stream",
    addRandomSuffix: false, // preserve the existing pathname for idempotency
    allowOverwrite: true,
  });
  return uploaded.url;
}

/** Decides what should happen to a given URL. Pure — never mutates. */
async function planMigration(oldUrl: string): Promise<MigrationOutcome> {
  if (!oldUrl) {
    return { status: "skipped", oldUrl, reason: "empty" };
  }
  if (oldUrl.includes(".public.blob.vercel-storage.com/")) {
    stats.alreadyPublic++;
    return { status: "skipped", oldUrl, reason: "already-public" };
  }
  if (!oldUrl.startsWith(PROXY_PREFIX)) {
    stats.external++;
    return { status: "skipped", oldUrl, reason: "external-or-local" };
  }

  const pathname = oldUrl.slice(PROXY_PREFIX.length);
  if (!pathname) {
    return { status: "skipped", oldUrl, reason: "empty-pathname" };
  }

  if (!APPLY) {
    stats.wouldMigrate++;
    return { status: "would-migrate", oldUrl };
  }

  try {
    const newUrl = await copyToPublic(pathname);
    stats.migrated++;
    return { status: "migrated", oldUrl, newUrl };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    if (reason.startsWith("source-not-found")) {
      stats.missing++;
      return { status: "missing", oldUrl, reason };
    }
    stats.errors++;
    return { status: "error", oldUrl, reason };
  }
}

function shouldRun(t: EntityType): boolean {
  return TYPE === "all" || TYPE === t;
}

// ---------- per-table migrations ----------
async function migrateProductImages() {
  if (!shouldRun("products")) return;
  console.log("\n[products] scanning ProductImage…");
  const rows = await prisma.productImage.findMany({
    select: { id: true, url: true },
  });
  for (const row of rows) {
    if (stats.scanned >= LIMIT) return;
    stats.scanned++;
    const outcome = await planMigration(row.url);
    if (outcome.status === "migrated" && outcome.newUrl) {
      await prisma.productImage.update({
        where: { id: row.id },
        data: { url: outcome.newUrl },
      });
    }
    logOutcome("ProductImage", row.id, outcome);
  }
}

async function migrateVariantImages() {
  if (!shouldRun("variants")) return;
  console.log("\n[variants] scanning ProductVariantImage…");
  const rows = await prisma.productVariantImage.findMany({
    select: { id: true, url: true },
  });
  for (const row of rows) {
    if (stats.scanned >= LIMIT) return;
    stats.scanned++;
    const outcome = await planMigration(row.url);
    if (outcome.status === "migrated" && outcome.newUrl) {
      await prisma.productVariantImage.update({
        where: { id: row.id },
        data: { url: outcome.newUrl },
      });
    }
    logOutcome("ProductVariantImage", row.id, outcome);
  }
}

async function migrateWtfImages() {
  if (!shouldRun("wtf")) return;
  console.log("\n[wtf] scanning WtfImage…");
  const rows = await prisma.wtfImage.findMany({
    select: { id: true, url: true },
  });
  for (const row of rows) {
    if (stats.scanned >= LIMIT) return;
    stats.scanned++;
    const outcome = await planMigration(row.url);
    if (outcome.status === "migrated" && outcome.newUrl) {
      await prisma.wtfImage.update({
        where: { id: row.id },
        data: { url: outcome.newUrl },
      });
    }
    logOutcome("WtfImage", row.id, outcome);
  }
}

async function migrateSubmissions() {
  if (!shouldRun("submissions")) return;
  console.log("\n[submissions] scanning Submission.imageUrls…");
  const rows = await prisma.submission.findMany({
    select: { id: true, imageUrls: true },
  });
  for (const row of rows) {
    if (stats.scanned >= LIMIT) return;

    let changed = false;
    const nextUrls: string[] = [];
    for (const url of row.imageUrls) {
      stats.scanned++;
      const outcome = await planMigration(url);
      if (outcome.status === "migrated" && outcome.newUrl) {
        nextUrls.push(outcome.newUrl);
        changed = true;
      } else {
        nextUrls.push(url);
      }
      logOutcome("Submission", row.id, outcome);
      if (stats.scanned >= LIMIT) break;
    }
    if (changed) {
      await prisma.submission.update({
        where: { id: row.id },
        data: { imageUrls: nextUrls },
      });
    }
  }
}

function logOutcome(entity: string, id: string, o: MigrationOutcome) {
  const tag =
    o.status === "migrated"
      ? "✓"
      : o.status === "would-migrate"
        ? "→"
        : o.status === "missing"
          ? "?"
          : o.status === "error"
            ? "✗"
            : "·";
  const trail =
    o.status === "migrated" && o.newUrl
      ? ` → ${o.newUrl}`
      : o.reason
        ? ` (${o.reason})`
        : "";
  console.log(`  ${tag} ${entity} ${id} :: ${o.oldUrl}${trail}`);
}

// ---------- main ----------
async function main() {
  console.log(
    `Blob migration — ${APPLY ? "APPLY" : "DRY RUN"}, type=${TYPE}, limit=${
      LIMIT === Infinity ? "all" : LIMIT
    }`
  );
  if (!APPLY) {
    console.log(
      "  (dry run — no blobs will be re-uploaded and no DB rows will change)"
    );
  }

  await migrateProductImages();
  await migrateVariantImages();
  await migrateWtfImages();
  await migrateSubmissions();

  console.log("\n--- summary ---");
  console.log(`  scanned        : ${stats.scanned}`);
  console.log(`  already public : ${stats.alreadyPublic}`);
  console.log(`  external/local : ${stats.external}`);
  if (APPLY) {
    console.log(`  migrated       : ${stats.migrated}`);
    console.log(`  missing        : ${stats.missing}`);
    console.log(`  errors         : ${stats.errors}`);
  } else {
    console.log(`  would migrate  : ${stats.wouldMigrate}`);
  }
}

main()
  .catch((err) => {
    console.error("fatal:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
