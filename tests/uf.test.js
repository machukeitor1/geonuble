// Tests del valor de la UF: fuentes, caché y respaldos (sin llamar a internet).
import "./helpers/tempdb.js";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getUf, convert, _setUfFetch } from "../lib/uf.js";
import { query } from "../lib/db.js";

const reply = (body, status = 200) => async () => new Response(JSON.stringify(body), { status });
const mindicador = (valor) => reply({ serie: [{ fecha: "2026-11-25T03:00:00.000Z", valor }] });

beforeEach(async () => {
  delete process.env.CMF_API_KEY;
  delete process.env.UF_CLP;
  await query("DELETE FROM settings WHERE key = 'uf_clp'");
});

test("uf: usa mindicador.cl sin clave y guarda en settings", async () => {
  let calls = 0;
  _setUfFetch(async (url, opts) => { calls++; assert.match(url, /mindicador\.cl/); return mindicador(41405.45)(url, opts); });
  assert.deepEqual(await getUf(), { valor: 41405.45, fecha: "2026-11-25", fuente: "mindicador.cl" });
  await getUf();
  assert.equal(calls, 1, "la segunda vez sale del caché en memoria");
  const [row] = await query("SELECT value FROM settings WHERE key = 'uf_clp'");
  assert.equal(JSON.parse(row.value).valor, 41405.45);
});

test("uf: con CMF_API_KEY usa la CMF y entiende el formato chileno", async () => {
  process.env.CMF_API_KEY = "clave-de-prueba";
  _setUfFetch(async (url) => {
    assert.match(url, /api\.cmfchile\.cl/);
    return reply({ UFs: [{ Valor: "41.405,45", Fecha: "2026-11-25" }] })();
  });
  assert.equal((await getUf()).fuente, "CMF");
  assert.equal((await getUf()).valor, 41405.45);
});

test("uf: si la fuente falla usa el último valor guardado, aunque sea viejo", async () => {
  _setUfFetch(mindicador(40000));
  await getUf();
  await query("UPDATE settings SET value = $1 WHERE key = 'uf_clp'", [
    JSON.stringify({ valor: 40000, fecha: "2026-11-01", fuente: "mindicador.cl", fetchedAt: 0 }),
  ]);
  _setUfFetch(reply({}, 503));
  const uf = await getUf();
  assert.equal(uf.valor, 40000);
});

test("uf: sin fuente ni valor guardado usa UF_CLP, y si no hay, null", async () => {
  _setUfFetch(async () => { throw new Error("sin red"); });
  process.env.UF_CLP = "41000";
  assert.equal((await getUf()).fuente, "UF_CLP");
  _setUfFetch(async () => { throw new Error("sin red"); });
  delete process.env.UF_CLP;
  assert.equal(await getUf(), null);
});

test("uf: descarta valores absurdos", async () => {
  _setUfFetch(mindicador(5));
  assert.equal(await getUf(), null);
});

test("convert: UF <-> CLP en ambos sentidos", () => {
  const uf = { valor: 40000 };
  assert.equal(convert(3000, "UF", "CLP", uf), 120000000);
  assert.equal(convert(120000000, "CLP", "UF", uf), 3000);
  assert.equal(convert(5, "UF", "UF", null), 5);
  assert.equal(convert(5, "UF", "CLP", null), null);
});
