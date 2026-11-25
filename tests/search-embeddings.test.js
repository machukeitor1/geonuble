// Embeddings de propiedades: se generan al guardar, no se recalculan si el texto
// no cambió y un fallo del proveedor no impide guardar la propiedad.
import "./helpers/tempdb.js";
import { test, before } from "node:test";
import assert from "node:assert/strict";

process.env.EMBEDDINGS_DIM = "8";
process.env.ADMIN_EMAIL = "admin@geonuble.test";
process.env.ADMIN_PASSWORD = "admin-test-1234";

const { _setProviders } = await import("../lib/search/providers.js");
const { embedPending } = await import("../lib/search/embeddings.js");
const { query } = await import("../lib/db.js");
const auth = await import("../api/auth.js");
const properties = await import("../api/properties.js");

let embedded = [];
let failing = false;
_setProviders({
  embed: async (texts) => {
    if (failing) throw new Error("proveedor caído");
    embedded.push(...texts);
    return texts.map((t) => Array.from({ length: 8 }, (_, i) => ((t.length + i) % 7) / 7 + 0.01));
  },
});

let cookie;
const B = "http://localhost/api";
const call = async (method, path, body) => {
  const res = await properties[method](
    new Request(B + path, { method, headers: { cookie, "content-type": "application/json" }, body: body && JSON.stringify(body) })
  );
  return { status: res.status, data: await res.json() };
};
const stored = async (id) => (await query("SELECT embedding::text AS e, embedding_hash FROM properties WHERE id = $1", [id]))[0];

before(async () => {
  const res = await auth.POST(new Request(B + "/auth", {
    method: "POST",
    body: JSON.stringify({ email: "admin@geonuble.test", password: "admin-test-1234" }),
  }));
  cookie = res.headers.get("set-cookie").split(";")[0];
});

const base = { title: "Casa en Chillán", type: "Casa", commune: "Chillán", description: "Luminosa", features: ["Patio"], status: "published" };

test("embedding: se genera al crear y no se recalcula si el texto no cambia", async () => {
  embedded = [];
  const { status, data } = await call("POST", "/properties", base);
  assert.equal(status, 201);
  assert.ok(!("embedding" in data));
  const first = await stored(data.id);
  assert.ok(first.e && first.embedding_hash);
  assert.equal(embedded.length, 1);
  assert.match(embedded[0], /Casa en Chillán/);
  assert.match(embedded[0], /Patio/);

  await call("PUT", `/properties?id=${data.id}`, { ...base, status: "sold", price: 5000, featured: true });
  assert.equal(embedded.length, 1, "cambiar estado o precio no recalcula");

  await call("PUT", `/properties?id=${data.id}`, { ...base, description: "Luminosa y con vista a la cordillera" });
  assert.equal(embedded.length, 2, "cambiar la descripción sí recalcula");
  assert.notEqual((await stored(data.id)).embedding_hash, first.embedding_hash);
});

test("embedding: si el proveedor falla, la propiedad igual se guarda", async () => {
  failing = true;
  const { status, data } = await call("POST", "/properties", { ...base, title: "Parcela en Pinto" });
  failing = false;
  assert.equal(status, 201);
  assert.equal((await stored(data.id)).embedding_hash, null);

  embedded = [];
  const result = await embedPending();
  assert.equal(result.actualizados, 1, "el backfill completa solo la que faltaba");
  assert.equal(embedded.length, 1);
  assert.equal((await embedPending()).actualizados, 0, "una segunda pasada no hace nada");
});
