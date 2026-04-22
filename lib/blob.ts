import { put, del } from "@vercel/blob";

export async function uploadImage(
  file: File,
  folder: string = "products"
): Promise<string> {
  const filename = `${folder}/${Date.now()}-${file.name.replace(/[^a-z0-9.\-_]/gi, "-")}`;
  const blob = await put(filename, file, {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return blob.url;
}

export async function deleteImage(url: string): Promise<void> {
  await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
}
