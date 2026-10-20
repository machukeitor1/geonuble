import { AwsClient } from "aws4fetch";

// Almacenamiento de imágenes en Cloudflare R2 (API compatible con S3).
// Sin variables R2_* (desarrollo local) guarda los archivos en public/uploads/.
const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_PUBLIC_URL,
} = process.env;

const r2Enabled = Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET);

const r2 = r2Enabled
  ? new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      service: "s3",
      region: "auto",
    })
  : null;

const objectUrl = (key) =>
  `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`;

export async function putImage(key, body, contentType) {
  if (r2) {
    const res = await r2.fetch(objectUrl(key), {
      method: "PUT",
      body,
      headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
    });
    if (!res.ok) throw new Error(`R2 respondió ${res.status}: ${await res.text()}`);
    return `${R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  }

  if (process.env.VERCEL) throw new Error("Falta configurar Cloudflare R2 (variables R2_*)");
  const { mkdir, writeFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const file = path.join("public", "uploads", key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(body));
  return `/uploads/${key}`;
}

export async function deleteImage(key) {
  if (!key || key.includes("..")) return;
  if (r2) {
    await r2.fetch(objectUrl(key), { method: "DELETE" });
    return;
  }
  if (process.env.VERCEL) return;
  const { rm } = await import("node:fs/promises");
  const path = await import("node:path");
  await rm(path.join("public", "uploads", key), { force: true });
}
