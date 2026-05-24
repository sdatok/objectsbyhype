import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { blobPutAccess } from "@/lib/server-upload";

export const runtime = "nodejs";

/**
 * Proxies Blob storage for private stores (and can fetch public blobs by pathname).
 * Uploads with BLOB_PUT_ACCESS=private return URLs like /api/media/blob/products/...
 *
 * Caching: blob filenames embed an upload timestamp (`<ms>-<sanitized-name>`),
 * so the content at any given path is effectively immutable. We send a
 * `public, immutable, max-age=1y` header so the Vercel Edge cache and the
 * browser hold the bytes indefinitely instead of re-fetching from Blob
 * storage (which is what was burning through Blob Data Transfer).
 *
 * `If-None-Match` is forwarded to Vercel Blob so that even on a cold edge
 * miss we get a 304 instead of paying the egress for a re-stream when the
 * client/CDN already has the right ETag.
 */
const IMMUTABLE_CACHE =
  "public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=86400";

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await context.params;
  if (!segments?.length) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const pathname = segments.join("/");
  if (
    !pathname.startsWith("products/") &&
    !pathname.startsWith("submissions/") &&
    !pathname.startsWith("wtf/")
  ) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  if (pathname.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const access = blobPutAccess();
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (!token) {
    const proxyBase = process.env.DEV_MEDIA_PROXY_BASE_URL?.trim().replace(/\/$/, "");
    if (proxyBase && process.env.NODE_ENV === "development") {
      const target = `${proxyBase}/api/media/blob/${pathname}`;
      return NextResponse.redirect(target, 307);
    }

    return NextResponse.json(
      {
        error:
          "Blob storage not configured locally. Add BLOB_READ_WRITE_TOKEN to .env (copy from Vercel → Project → Settings → Environment Variables), or set DEV_MEDIA_PROXY_BASE_URL to your production origin (e.g. https://your-app.vercel.app) so /api/media/blob/* can redirect there in development.",
      },
      { status: 503 }
    );
  }

  const ifNoneMatch = request.headers.get("if-none-match") ?? undefined;

  try {
    const result = await get(pathname, {
      access,
      token,
      ...(ifNoneMatch ? { ifNoneMatch } : {}),
    });

    if (!result) {
      return new NextResponse("Not found", { status: 404 });
    }

    // 304 from Blob means the caller's ETag still matches — zero egress.
    if (result.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: { "Cache-Control": IMMUTABLE_CACHE },
      });
    }

    if (result.statusCode !== 200 || !result.stream) {
      return new NextResponse("Not found", { status: 404 });
    }

    const etag =
      (result.blob as unknown as { etag?: string }).etag ??
      (result as unknown as { headers?: { etag?: string } }).headers?.etag;

    const headers: Record<string, string> = {
      "Content-Type": result.blob.contentType ?? "application/octet-stream",
      "Cache-Control": IMMUTABLE_CACHE,
    };
    if (etag) headers["ETag"] = etag;

    return new NextResponse(result.stream, { headers });
  } catch (e) {
    console.error("Blob media proxy failed:", e);
    return new NextResponse("Not found", { status: 404 });
  }
}
