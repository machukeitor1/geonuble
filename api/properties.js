import { handle, json, readJson, text, numberOrNull, intOrNull, getId, HttpError } from "../lib/http.js";
import { query } from "../lib/db.js";
import { getUser, requireAdmin } from "../lib/auth.js";
import { deleteImage } from "../lib/storage.js";

const STATUSES = ["draft", "published", "sold"];

// Público: solo propiedades publicadas. Con sesión iniciada: todas.
export const GET = handle(async (request) => {
  const params = new URL(request.url).searchParams;
  const user = await getUser(request);
  const onlyPublished = !user || params.get("all") !== "1";
  const filter = onlyPublished ? "status = 'published'" : "TRUE";

  if (params.has("id")) {
    const [property] = await query(`SELECT * FROM properties WHERE id = $1 AND ${user ? "TRUE" : filter}`, [getId(request)]);
    if (!property) throw new HttpError(404, "Propiedad no encontrada");
    return json(property);
  }

  return json(
    await query(`SELECT * FROM properties WHERE ${filter} ORDER BY featured DESC, created_at DESC`)
  );
});

function cleanImages(images) {
  if (!Array.isArray(images)) return [];
  return images
    .filter((img) => img && typeof img.url === "string")
    .map(({ url, key, thumb, thumbKey }) => ({ url, key, thumb: thumb || url, thumbKey }));
}

function readProperty(body) {
  const title = text(body.title, 200);
  if (!title) throw new HttpError(400, "El título es obligatorio");
  const lat = numberOrNull(body.lat);
  const lng = numberOrNull(body.lng);
  const features = Array.isArray(body.features)
    ? body.features.map((f) => text(f, 200)).filter(Boolean)
    : [];

  return [
    title,
    text(body.description, 10000),
    text(body.operation, 50) || "Venta",
    text(body.type, 50) || "Casa",
    numberOrNull(body.price),
    text(body.currency, 10) || "UF",
    text(body.address, 300),
    text(body.commune, 100),
    lat,
    lng,
    numberOrNull(body.total_area),
    numberOrNull(body.built_area),
    intOrNull(body.bedrooms, "Dormitorios"),
    intOrNull(body.bathrooms, "Baños"),
    intOrNull(body.parking, "Estacionamientos"),
    JSON.stringify(features),
    JSON.stringify(cleanImages(body.images)),
    STATUSES.includes(body.status) ? body.status : "draft",
    Boolean(body.featured),
  ];
}

const COLUMNS = `title, description, operation, type, price, currency, address, commune, lat, lng,
  total_area, built_area, bedrooms, bathrooms, parking, features, images, status, featured`;

export const POST = handle(async (request) => {
  await requireAdmin(request);
  const values = readProperty(await readJson(request));
  const [property] = await query(
    `INSERT INTO properties (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb, $18, $19) RETURNING *`,
    values
  );
  return json(property, 201);
});

export const PUT = handle(async (request) => {
  await requireAdmin(request);
  const id = getId(request);
  const values = readProperty(await readJson(request));

  const [before] = await query("SELECT images FROM properties WHERE id = $1", [id]);
  if (!before) throw new HttpError(404, "Propiedad no encontrada");

  const [property] = await query(
    `UPDATE properties SET (${COLUMNS}, updated_at) = ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb, $18, $19, now()) WHERE id = $20 RETURNING *`,
    [...values, id]
  );

  // Borra del almacenamiento las fotos que se quitaron.
  const kept = new Set(property.images.flatMap((img) => [img.key, img.thumbKey]));
  const removed = before.images.flatMap((img) => [img.key, img.thumbKey]).filter((k) => k && !kept.has(k));
  await Promise.all(removed.map(deleteImage));

  return json(property);
});

export const DELETE = handle(async (request) => {
  await requireAdmin(request);
  const [property] = await query("DELETE FROM properties WHERE id = $1 RETURNING images", [getId(request)]);
  if (property) {
    await Promise.all(property.images.flatMap((img) => [deleteImage(img.key), deleteImage(img.thumbKey)]));
  }
  return json({ ok: true });
});
