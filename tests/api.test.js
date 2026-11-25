// Tests de integración de /api. Corren contra una base PGlite temporal
// (carpeta del sistema), sin tocar .data/ ni public/uploads/ del proyecto.
// Uso: npm test
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TMP = await mkdtemp(path.join(tmpdir(), "geonuble-test-"));
process.chdir(TMP);
// Al salir: PGlite mantiene archivos abiertos mientras corren los tests.
process.on("exit", () => {
  process.chdir(ROOT);
  try { rmSync(TMP, { recursive: true, force: true }); } catch { /* el SO limpia tmp */ }
});
delete process.env.VERCEL;
process.env.ADMIN_EMAIL = "admin@geonuble.test";
process.env.ADMIN_PASSWORD = "admin-test-1234";
process.env.ADMIN_NAME = "Admin Test";
delete process.env.DATABASE_URL;
delete process.env.RESEND_API_KEY;

const load = (name) => import(pathToFileURL(path.join(ROOT, "api", `${name}.js`)).href);
let auth, users, properties, quotes, contact, settings, upload;
let adminCookie, brokerCookie;

const B = "http://localhost:5173/api";
function req(path, { method = "GET", body, cookie, headers = {}, raw } = {}) {
  const h = { ...headers };
  if (cookie) h.cookie = cookie;
  if (body !== undefined && !raw) h["content-type"] = "application/json";
  return new Request(B + path, { method, headers: h, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
}
const cookieOf = (res) => res.headers.get("set-cookie").split(";")[0];
async function call(mod, path, opts) {
  const res = await mod[opts?.method || "GET"](req(path, opts));
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  return { status: res.status, data, res };
}

before(async () => {
  [auth, users, properties, quotes, contact, settings, upload] = await Promise.all(
    ["auth", "users", "properties", "quotes", "contact", "settings", "upload"].map(load)
  );
});

test("auth: login incorrecto 401, correcto 200 con cookie HttpOnly", async () => {
  const bad = await call(auth, "/auth", { method: "POST", body: { email: "admin@geonuble.test", password: "x" } });
  assert.equal(bad.status, 401);
  const ok = await call(auth, "/auth", { method: "POST", body: { email: "ADMIN@geonuble.test", password: "admin-test-1234" } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.role, "admin");
  assert.equal(ok.data.user.password_hash, undefined);
  assert.match(ok.res.headers.get("set-cookie"), /HttpOnly; SameSite=Lax/);
  adminCookie = cookieOf(ok.res);
  const me = await call(auth, "/auth", { cookie: adminCookie });
  assert.equal(me.data.user.email, "admin@geonuble.test");
});

test("auth: JSON inválido -> 400; cookie falsa -> sin usuario", async () => {
  const res = await auth.POST(new Request(B + "/auth", { method: "POST", body: "{no json" }));
  assert.equal(res.status, 400);
  const me = await call(auth, "/auth", { cookie: "geonuble_session=abc.def.ghi" });
  assert.equal(me.data.user, null);
});

test("users: crear corredor, duplicado 409, contraseña corta 400", async () => {
  const created = await call(users, "/users", { method: "POST", cookie: adminCookie,
    body: { email: "corredor@geonuble.test", name: "Corredor", password: "broker-1234", role: "broker" } });
  assert.equal(created.status, 201);
  const dup = await call(users, "/users", { method: "POST", cookie: adminCookie,
    body: { email: "CORREDOR@geonuble.test", name: "X", password: "broker-1234" } });
  assert.equal(dup.status, 409);
  const short = await call(users, "/users", { method: "POST", cookie: adminCookie,
    body: { email: "otro@geonuble.test", name: "X", password: "123" } });
  assert.equal(short.status, 400);
  const login = await call(auth, "/auth", { method: "POST", body: { email: "corredor@geonuble.test", password: "broker-1234" } });
  brokerCookie = cookieOf(login.res);
});

test("users: corredor no puede listar/crear usuarios (403), anónimo 401", async () => {
  assert.equal((await call(users, "/users", { cookie: brokerCookie })).status, 403);
  assert.equal((await call(users, "/users")).status, 401);
  assert.equal((await call(users, "/users", { method: "POST", cookie: brokerCookie,
    body: { email: "h@x.test", name: "h", password: "12345678", role: "admin" } })).status, 403);
});

test("users: admin no puede quitarse el rol ni borrarse", async () => {
  const me = (await call(auth, "/auth", { cookie: adminCookie })).data.user;
  const upd = await call(users, `/users?id=${me.id}`, { method: "PUT", cookie: adminCookie,
    body: { email: me.email, name: me.name, role: "broker", active: false } });
  assert.equal(upd.data.role, "admin");
  assert.equal(upd.data.active, true);
  assert.equal((await call(users, `/users?id=${me.id}`, { method: "DELETE", cookie: adminCookie })).status, 400);
});

test("users: PUT con contraseña corta -> 400 sin guardar cambios", async () => {
  const list = (await call(users, "/users", { cookie: adminCookie })).data;
  const b = list.find((u) => u.email === "corredor@geonuble.test");
  const res = await call(users, `/users?id=${b.id}`, { method: "PUT", cookie: adminCookie,
    body: { email: b.email, name: "Nombre Cambiado", role: "broker", password: "123" } });
  assert.equal(res.status, 400);
  const after = (await call(users, "/users", { cookie: adminCookie })).data.find((u) => u.id === b.id);
  assert.equal(after.name, "Corredor", "el nombre se guardó aunque la petición falló");
});

test("users: cambiar contraseña propia exige la actual", async () => {
  const wrong = await call(users, "/users?id=me", { method: "PUT", cookie: brokerCookie,
    body: { currentPassword: "mala", password: "nueva-1234" } });
  assert.equal(wrong.status, 400);
  const ok = await call(users, "/users?id=me", { method: "PUT", cookie: brokerCookie,
    body: { currentPassword: "broker-1234", password: "nueva-1234" } });
  assert.equal(ok.status, 200);
});

let draftId, pubId;
test("properties: CRUD admin y visibilidad pública", async () => {
  const draft = await call(properties, "/properties", { method: "POST", cookie: adminCookie,
    body: { title: "Casa borrador", price: "5000", bedrooms: "3", status: "draft" } });
  assert.equal(draft.status, 201);
  assert.equal(draft.data.price, 5000);
  draftId = draft.data.id;
  const pub = await call(properties, "/properties", { method: "POST", cookie: adminCookie,
    body: { title: "Casa publicada", status: "published", features: ["Piscina", "", 3], images: [{ url: "/x.jpg" }, null, { url: 5 }] } });
  pubId = pub.data.id;
  assert.deepEqual(pub.data.images, [{ url: "/x.jpg", thumb: "/x.jpg" }]);
  assert.equal((await call(properties, "/properties", { method: "POST", cookie: adminCookie, body: { title: "  " } })).status, 400);

  const anon = (await call(properties, "/properties")).data;
  assert.deepEqual(anon.map((p) => p.id), [pubId]);
  assert.equal((await call(properties, `/properties?id=${draftId}`)).status, 404);
  assert.equal((await call(properties, `/properties?id=${draftId}`, { cookie: brokerCookie })).status, 200);
  assert.equal((await call(properties, "/properties?all=1", { cookie: adminCookie })).data.length, 2);
  assert.equal((await call(properties, "/properties", { method: "POST", cookie: brokerCookie, body: { title: "x" } })).status, 403);
  assert.equal((await call(properties, "/properties?id=abc")).status, 400);
});

test("properties: dormitorios/baños/estacionamientos no enteros -> 400", async () => {
  for (const body of [{ bedrooms: "2.5" }, { bathrooms: -1 }, { parking: 99999999999 }]) {
    const res = await call(properties, "/properties", { method: "POST", cookie: adminCookie, body: { title: "Raro", ...body } });
    assert.equal(res.status, 400, JSON.stringify(body));
  }
});

test("properties: PUT inexistente 404, DELETE ok", async () => {
  assert.equal((await call(properties, "/properties?id=9999", { method: "PUT", cookie: adminCookie, body: { title: "x" } })).status, 404);
  assert.equal((await call(properties, `/properties?id=${draftId}`, { method: "DELETE", cookie: adminCookie })).status, 200);
});

test("quotes: corredor crea y ve solo las suyas; validez acotada", async () => {
  const q = await call(quotes, "/quotes", { method: "POST", cookie: brokerCookie,
    body: { property_id: pubId, client_name: "Cliente", sections: ["photo", "price"], validity_days: 9999 } });
  assert.equal(q.status, 201);
  assert.equal(q.data.validity_days, 365);
  assert.equal(q.data.broker_email, "corredor@geonuble.test");
  const qa = await call(quotes, "/quotes", { method: "POST", cookie: adminCookie, body: { property_id: pubId } });
  assert.equal((await call(quotes, "/quotes", { cookie: brokerCookie })).data.length, 1);
  assert.equal((await call(quotes, "/quotes", { cookie: adminCookie })).data.length, 2);
  assert.equal((await call(quotes, `/quotes?id=${qa.data.id}`, { cookie: brokerCookie })).status, 404);
  assert.equal((await call(quotes, "/quotes")).status, 401);
  assert.equal((await call(quotes, "/quotes", { method: "POST", cookie: brokerCookie, body: { property_id: 9999 } })).status, 404);
});

test("quotes: property_id inválido -> 400", async () => {
  for (const property_id of ["abc", undefined, -3, 1.5]) {
    const res = await call(quotes, "/quotes", { method: "POST", cookie: brokerCookie, body: { property_id } });
    assert.equal(res.status, 400, String(property_id));
  }
});

test("contact: honeypot, validación y lectura solo admin", async () => {
  assert.equal((await call(contact, "/contact", { method: "POST", body: { name: "Bot", email: "b", message: "m", website: "x" } })).status, 201);
  assert.equal((await call(contact, "/contact", { method: "POST", body: { name: "A" } })).status, 400);
  assert.equal((await call(contact, "/contact", { method: "POST", body: { name: "Ana", email: "ana@x.test", message: "Hola <b>" } })).status, 201);
  assert.equal((await call(contact, "/contact", { cookie: brokerCookie })).status, 403);
  const list = (await call(contact, "/contact", { cookie: adminCookie })).data;
  assert.equal(list.length, 1, "el honeypot no debe guardar");
  const sum = (await call(contact, "/contact?summary=1", { cookie: adminCookie })).data;
  assert.equal(sum.unread, 1);
  await call(contact, `/contact?id=${list[0].id}`, { method: "PUT", cookie: adminCookie, body: { read: true } });
  assert.equal((await call(contact, "/contact?summary=1", { cookie: adminCookie })).data.unread, 0);
});

test("settings: público lee, solo admin escribe, claves desconocidas ignoradas", async () => {
  const s = (await call(settings, "/settings")).data;
  assert.equal(s.company_name, "Geoñuble Propiedades");
  assert.equal((await call(settings, "/settings", { method: "PUT", cookie: brokerCookie, body: { phone: "1" } })).status, 403);
  const upd = (await call(settings, "/settings", { method: "PUT", cookie: adminCookie, body: { phone: "+56 9 1234", evil: "x" } })).data;
  assert.equal(upd.phone, "+56 9 1234");
  assert.equal(upd.evil, undefined);
});

test("upload: tipos, tamaño, permisos y clave de borrado", async () => {
  const png = new Uint8Array([137, 80, 78, 71]);
  assert.equal((await call(upload, "/upload", { method: "POST", cookie: brokerCookie, raw: png, headers: { "content-type": "image/png" } })).status, 403);
  assert.equal((await call(upload, "/upload", { method: "POST", cookie: adminCookie, raw: png, headers: { "content-type": "image/gif" } })).status, 400);
  assert.equal((await call(upload, "/upload", { method: "POST", cookie: adminCookie, raw: new Uint8Array(5 * 1024 * 1024), headers: { "content-type": "image/png" } })).status, 413);
  const ok = await call(upload, "/upload", { method: "POST", cookie: adminCookie, raw: png, headers: { "content-type": "image/png" } });
  assert.equal(ok.status, 201);
  assert.match(ok.data.url, /^\/uploads\/propiedades\//);
  assert.equal((await call(upload, "/upload?key=../../package.json", { method: "DELETE", cookie: adminCookie })).status, 400);
  assert.equal((await call(upload, `/upload?key=${ok.data.key}`, { method: "DELETE", cookie: adminCookie })).status, 200);
});

test("auth: usuario desactivado pierde la sesión", async () => {
  const b = (await call(users, "/users", { cookie: adminCookie })).data.find((u) => u.email === "corredor@geonuble.test");
  await call(users, `/users?id=${b.id}`, { method: "PUT", cookie: adminCookie, body: { email: b.email, name: b.name, role: "broker", active: false } });
  assert.equal((await call(auth, "/auth", { cookie: brokerCookie })).data.user, null);
});
