import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { HttpError } from "./http.js";
import { query } from "./db.js";

const COOKIE = "geonuble_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 días

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) {
    if (process.env.VERCEL) throw new Error("Falta configurar JWT_SECRET");
    return new TextEncoder().encode("solo-para-desarrollo-local");
  }
  return new TextEncoder().encode(value);
}

export const hashPassword = (password) => bcrypt.hash(password, 10);
export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

export async function sessionCookie(userId) {
  const token = await new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  return cookie(token, MAX_AGE);
}

export function clearCookie() {
  return cookie("", 0);
}

function cookie(value, maxAge) {
  const secure = process.env.VERCEL ? "; Secure" : "";
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export const USER_FIELDS = "id, email, name, role, phone, position, active";

// Devuelve el usuario de la sesión o null.
export async function getUser(request) {
  const match = (request.headers.get("cookie") || "").match(new RegExp(`${COOKIE}=([^;]+)`));
  if (!match) return null;
  try {
    const { payload } = await jwtVerify(match[1], secret());
    const [user] = await query(`SELECT ${USER_FIELDS} FROM users WHERE id = $1`, [Number(payload.sub)]);
    return user?.active ? user : null;
  } catch {
    return null;
  }
}

export async function requireUser(request, role) {
  const user = await getUser(request);
  if (!user) throw new HttpError(401, "Debes iniciar sesión");
  if (role && user.role !== role) throw new HttpError(403, "No tienes permiso");
  return user;
}

export const requireAdmin = (request) => requireUser(request, "admin");
