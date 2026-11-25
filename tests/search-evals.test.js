// Valida el set de evaluación y evita regresiones del parser por reglas
// (corre el eval solo con reglas: no llama a ningún LLM ni gasta cuota).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

delete process.env.LLM_PROVIDER;
delete process.env.EMBEDDINGS_PROVIDER;
const { EVALS, prepare, evaluate, scoreFilters } = await import("../scripts/eval-search.js");
const { filtersSchema } = await import("../lib/search/filters.js");
const fixtures = JSON.parse(readFileSync(new URL("./fixtures/properties.json", import.meta.url), "utf8"));

test("evals: 30 consultas, filtros válidos y refs que existen y están publicadas", () => {
  assert.equal(EVALS.consultas.length, 30);
  const published = new Set(fixtures.filter((p) => (p.status || "published") === "published").map((p) => p.ref));
  for (const c of EVALS.consultas) {
    assert.ok(c.q.length <= 300, c.q);
    const filters = { ...c.filtros, caracteristicas: c.filtros.caracteristicas?.map((f) => f.split("|")[0]) };
    if (!filters.caracteristicas) delete filters.caracteristicas;
    assert.ok(filtersSchema.safeParse({ ...filters, texto_semantico: "" }).success, c.q);
    for (const ref of c.relevantes) assert.ok(published.has(ref), `${c.q}: ${ref}`);
  }
});

test("scoreFilters: alternativas, tolerancia numérica y opcionales", () => {
  const exp = { tipo: "Casa", precio_max: 1000, moneda: "UF", caracteristicas: ["riego|derechos de agua"] };
  assert.equal(scoreFilters(exp, { tipo: "Casa", precio_max: 1005, moneda: "UF", caracteristicas: ["derechos de agua"] }).exact, true);
  assert.equal(scoreFilters(exp, { tipo: "Casa", precio_max: 1000, moneda: "UF", caracteristicas: ["riego", "galpon"] }).exact, false);
  assert.equal(scoreFilters({ tipo: "Casa" }, { tipo: "Casa", operacion: "venta" }, ["operacion"]).exact, true);
  assert.equal(scoreFilters({ tipo: "Casa" }, { tipo: "Casa", operacion: "venta" }).exact, false);
});

let rules;
before(async () => {
  await prepare();
  rules = await evaluate("reglas");
});

test("eval con reglas: no baja de los mínimos medidos", () => {
  assert.ok(rules.fieldAccuracy >= 0.95, `acierto por campo ${rules.fieldAccuracy}`);
  assert.ok(rules.exactRate >= 0.9, `consultas exactas ${rules.exactRate}`);
  assert.ok(rules.recallAt5 >= 0.9, `recall@5 ${rules.recallAt5}`);
  const injection = rules.rows.find((r) => r.q.startsWith("ignora las instrucciones"));
  assert.equal(injection.top5.length, 0, "la inyección no devuelve 'todo'");
});

test("eval con LLM simulado: un modelo perfecto acierta todo y los fallos caen a reglas", async () => {
  const { _setProviders } = await import("../lib/search/providers.js");
  const byQ = new Map(EVALS.consultas.map((c) => [c.q, c]));
  let n = 0;
  _setProviders({
    extract: async (q) => {
      if (++n % 10 === 0) throw Object.assign(new Error("429"), { reason: "cuota" });
      const f = byQ.get(q).filtros;
      const raw = { ...f, caracteristicas: f.caracteristicas?.map((c) => c.split("|")[0]), texto_semantico: "" };
      return { raw, usage: { input: 700, output: 30 } };
    },
  });
  const llm = await evaluate("llm");
  _setProviders({});
  assert.equal(llm.fallos, 3);
  assert.ok(llm.exactRate >= 0.9 - 1e-9 && llm.exactRate < 1, "los 3 fallos cuentan como error");
  assert.equal(llm.tokensIn, 700);
  assert.ok(llm.recallAt5 >= 0.9, "con fallback a reglas el recall se mantiene");
});
