import { handle, json, readJson, text, getId, HttpError } from "../lib/http.js";
import { query } from "../lib/db.js";
import { requireUser, requireAdmin, hashPassword, verifyPassword, USER_FIELDS } from "../lib/auth.js";

const ROLES = ["admin", "broker"];

function checkPassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    throw new HttpError(400, "La contraseña debe tener al menos 8 caracteres");
  }
}

export const GET = handle(async (request) => {
  await requireAdmin(request);
  return json(await query(`SELECT ${USER_FIELDS}, created_at FROM users ORDER BY name`));
});

export const POST = handle(async (request) => {
  await requireAdmin(request);
  const body = await readJson(request);
  const email = text(body.email, 200).toLowerCase();
  const name = text(body.name, 200);
  if (!email || !name) throw new HttpError(400, "Nombre y email son obligatorios");
  checkPassword(body.password);

  const [exists] = await query("SELECT id FROM users WHERE email = $1", [email]);
  if (exists) throw new HttpError(409, "Ya existe un usuario con ese email");

  const [user] = await query(
    `INSERT INTO users (email, password_hash, name, role, phone, position, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${USER_FIELDS}`,
    [
      email,
      await hashPassword(body.password),
      name,
      ROLES.includes(body.role) ? body.role : "broker",
      text(body.phone, 50),
      text(body.position, 100) || "Corredor de Propiedades",
      body.active !== false,
    ]
  );
  return json(user, 201);
});

// El admin edita cualquier usuario. Cada usuario puede cambiar su propia contraseña
// con PUT ?id=me enviando currentPassword y password.
export const PUT = handle(async (request) => {
  const idParam = new URL(request.url).searchParams.get("id");
  const body = await readJson(request);

  if (idParam === "me") {
    const user = await requireUser(request);
    checkPassword(body.password);
    const [row] = await query("SELECT password_hash FROM users WHERE id = $1", [user.id]);
    if (!(await verifyPassword(String(body.currentPassword || ""), row.password_hash))) {
      throw new HttpError(400, "La contraseña actual no es correcta");
    }
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [await hashPassword(body.password), user.id]);
    return json({ ok: true });
  }

  const admin = await requireAdmin(request);
  const id = getId(request);
  const email = text(body.email, 200).toLowerCase();
  const name = text(body.name, 200);
  if (!email || !name) throw new HttpError(400, "Nombre y email son obligatorios");

  const [taken] = await query("SELECT id FROM users WHERE email = $1 AND id <> $2", [email, id]);
  if (taken) throw new HttpError(409, "Ya existe un usuario con ese email");

  // Evita que el admin se quite a sí mismo el acceso.
  const role = id === admin.id ? "admin" : ROLES.includes(body.role) ? body.role : "broker";
  const active = id === admin.id ? true : body.active !== false;

  const [user] = await query(
    `UPDATE users SET email = $1, name = $2, role = $3, phone = $4, position = $5, active = $6
     WHERE id = $7 RETURNING ${USER_FIELDS}`,
    [email, name, role, text(body.phone, 50), text(body.position, 100), active, id]
  );
  if (!user) throw new HttpError(404, "Usuario no encontrado");

  if (body.password) {
    checkPassword(body.password);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [await hashPassword(body.password), id]);
  }
  return json(user);
});

export const DELETE = handle(async (request) => {
  const admin = await requireAdmin(request);
  const id = getId(request);
  if (id === admin.id) throw new HttpError(400, "No puedes eliminar tu propio usuario");
  await query("DELETE FROM users WHERE id = $1", [id]);
  return json({ ok: true });
});
