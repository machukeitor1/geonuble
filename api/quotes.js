import { handle, json, readJson, text, getId, HttpError } from "../lib/http.js";
import { query } from "../lib/db.js";
import { requireUser } from "../lib/auth.js";

const QUOTE_SELECT = `
  SELECT q.*, p.title AS property_title,
         u.name AS broker_name, u.email AS broker_email, u.phone AS broker_phone, u.position AS broker_position
  FROM quotes q
  LEFT JOIN properties p ON p.id = q.property_id
  LEFT JOIN users u ON u.id = q.user_id`;

// Cada corredor ve sus cotizaciones; el admin ve todas.
export const GET = handle(async (request) => {
  const user = await requireUser(request);
  const params = new URL(request.url).searchParams;

  if (params.has("id")) {
    const [quote] = await query(`${QUOTE_SELECT} WHERE q.id = $1`, [getId(request)]);
    if (!quote || (user.role !== "admin" && quote.user_id !== user.id)) {
      throw new HttpError(404, "Cotización no encontrada");
    }
    return json(quote);
  }

  const rows =
    user.role === "admin"
      ? await query(`${QUOTE_SELECT} ORDER BY q.created_at DESC LIMIT 500`)
      : await query(`${QUOTE_SELECT} WHERE q.user_id = $1 ORDER BY q.created_at DESC LIMIT 500`, [user.id]);
  return json(rows);
});

// Registra la cotización (para numerarla) y devuelve los datos del corredor.
export const POST = handle(async (request) => {
  const user = await requireUser(request);
  const body = await readJson(request);
  const propertyId = Number(body.property_id);

  const [property] = await query("SELECT id FROM properties WHERE id = $1", [propertyId]);
  if (!property) throw new HttpError(404, "Propiedad no encontrada");

  const sections = Array.isArray(body.sections) ? body.sections.map((s) => text(s, 50)).filter(Boolean) : [];
  const validity = Math.min(Math.max(Number(body.validity_days) || 15, 1), 365);

  const [{ id }] = await query(
    `INSERT INTO quotes (property_id, user_id, client_name, notes, sections, validity_days)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING id`,
    [propertyId, user.id, text(body.client_name, 200), text(body.notes, 2000), JSON.stringify(sections), validity]
  );
  const [quote] = await query(`${QUOTE_SELECT} WHERE q.id = $1`, [id]);
  return json(quote, 201);
});
