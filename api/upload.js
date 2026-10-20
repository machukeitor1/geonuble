import { handle, json, HttpError } from "../lib/http.js";
import { requireAdmin } from "../lib/auth.js";
import { putImage, deleteImage } from "../lib/storage.js";

const TYPES = { "image/jpeg": "jpg", "image/webp": "webp", "image/png": "png" };
const MAX_BYTES = 4 * 1024 * 1024; // Vercel limita el cuerpo a 4,5 MB

// Recibe una imagen ya optimizada en el navegador (cuerpo binario).
export const POST = handle(async (request) => {
  await requireAdmin(request);
  const type = request.headers.get("content-type");
  const ext = TYPES[type];
  if (!ext) throw new HttpError(400, "Formato de imagen no permitido");

  const body = await request.arrayBuffer();
  if (body.byteLength === 0) throw new HttpError(400, "Imagen vacía");
  if (body.byteLength > MAX_BYTES) throw new HttpError(413, "La imagen pesa más de 4 MB");

  const key = `propiedades/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const url = await putImage(key, body, type);
  return json({ url, key }, 201);
});

// Borra una imagen subida que no llegó a guardarse en una propiedad.
export const DELETE = handle(async (request) => {
  await requireAdmin(request);
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!key.startsWith("propiedades/")) throw new HttpError(400, "Clave inválida");
  await deleteImage(key);
  return json({ ok: true });
});
