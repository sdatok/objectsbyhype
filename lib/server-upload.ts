import { put } from "@vercel/blob";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export function hasBlobToken(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

/**
 * Must match how the Blob store was created in Vercel:
 * - Private store → set BLOB_PUT_ACCESS=private (required)
 * - Public store → omit or set BLOB_PUT_ACCESS=public
 */
export function blobPutAccess(): "private" | "public" {
  const v = process.env.BLOB_PUT_ACCESS?.trim().toLowerCase();
  if (v === "private") return "private";
  return "public";
}

export type UploadFolder = "products" | "submissions" | "wtf";

export type SaveUploadResult =
  | { ok: true; url: string }
  | { ok: false; status: number; error: string };

/**
 * Saves an image to Vercel Blob when BLOB_READ_WRITE_TOKEN is set,
 * otherwise to public/{folder}/ (local dev only; Vercel FS is read-only).
 *
 * Private Blob stores: set BLOB_PUT_ACCESS=private. URLs point at /api/media/blob/...
 * so the storefront can load images without exposing the raw blob URL.
 */
export async function saveUploadedImage(
  file: File,
  folder: UploadFolder
): Promise<SaveUploadResult> {
  const safeName = `${Date.now()}-${file.name.replace(/[^a-z0-9.\-_]/gi, "-")}`;
  const pathname = `${folder}/${safeName}`;
  const access = blobPutAccess();

  if (hasBlobToken()) {
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const blob = await put(pathname, buf, {
        access,
        token: process.env.BLOB_READ_WRITE_TOKEN!.trim(),
        contentType: file.type || "application/octet-stream",
      });

      if (access === "private") {
        return { ok: true, url: `/api/media/blob/${blob.pathname}` };
      }
      return { ok: true, url: blob.url };
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      console.error("Blob upload failed:", detail, e);
      return {
        ok: false,
        status: 500,
        error:
          access === "public"
            ? "Upload failed. Confirm BLOB_READ_WRITE_TOKEN. If your store is Private, set BLOB_PUT_ACCESS=private and redeploy."
            : "Upload failed. Check BLOB_READ_WRITE_TOKEN and that BLOB_PUT_ACCESS=private matches a Private Blob store.",
      };
    }
  }

  const uploadDir = path.join(process.cwd(), "public", folder);
  try {
    await mkdir(uploadDir, { recursive: true });
    await writeFile(
      path.join(uploadDir, safeName),
      Buffer.from(await file.arrayBuffer())
    );
    return { ok: true, url: `/${folder}/${safeName}` };
  } catch (err) {
    console.error("Local filesystem upload failed:", err);
    return {
      ok: false,
      status: 503,
      error:
        "Cannot save files on this server. Add BLOB_READ_WRITE_TOKEN (Vercel Blob) to your environment.",
    };
  }
}
