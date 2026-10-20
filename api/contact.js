import { handle, json, readJson, text, getId, HttpError } from "../lib/http.js";
import { query } from "../lib/db.js";
import { requireAdmin } from "../lib/auth.js";

// Público: envía un mensaje desde el formulario de contacto.
export const POST = handle(async (request) => {
  const body = await readJson(request);
  // Campo trampa para bots: los humanos no lo ven ni lo llenan.
  if (body.website) return json({ ok: true }, 201);

  const name = text(body.name, 200);
  const email = text(body.email, 200);
  const message = text(body.message, 5000);
  if (!name || !email || !message) throw new HttpError(400, "Completa nombre, email y mensaje");

  await query(
    "INSERT INTO messages (name, email, phone, subject, message) VALUES ($1, $2, $3, $4, $5)",
    [name, email, text(body.phone, 50), text(body.subject, 200), message]
  );
  return json({ ok: true }, 201);
});

export const GET = handle(async (request) => {
  await requireAdmin(request);
  return json(await query("SELECT * FROM messages ORDER BY created_at DESC LIMIT 500"));
});

// Marca como leído / no leído.
export const PUT = handle(async (request) => {
  await requireAdmin(request);
  const body = await readJson(request);
  await query("UPDATE messages SET read = $1 WHERE id = $2", [Boolean(body.read), getId(request)]);
  return json({ ok: true });
});

export const DELETE = handle(async (request) => {
  await requireAdmin(request);
  await query("DELETE FROM messages WHERE id = $1", [getId(request)]);
  return json({ ok: true });
});
