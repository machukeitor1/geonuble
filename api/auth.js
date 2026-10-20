import { handle, json, readJson, text, HttpError } from "../lib/http.js";
import { query } from "../lib/db.js";
import { getUser, sessionCookie, clearCookie, verifyPassword, USER_FIELDS } from "../lib/auth.js";

// Sesión actual
export const GET = handle(async (request) => {
  return json({ user: await getUser(request) });
});

// Iniciar sesión
export const POST = handle(async (request) => {
  const body = await readJson(request);
  const email = text(body.email, 200).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";

  const [row] = await query(
    `SELECT ${USER_FIELDS}, password_hash FROM users WHERE email = $1`,
    [email]
  );
  const ok = row?.active && (await verifyPassword(password, row.password_hash));
  if (!ok) throw new HttpError(401, "Email o contraseña incorrectos");

  const { password_hash: _hash, ...user } = row;
  return json({ user }, 200, { "Set-Cookie": await sessionCookie(user.id) });
});

// Cerrar sesión
export const DELETE = handle(async () => {
  return json({ ok: true }, 200, { "Set-Cookie": clearCookie() });
});
