// Evaluación de la búsqueda con IA: compara el parser por reglas con el LLM configurado.
// Corre sobre una base temporal con las propiedades de tests/fixtures (nunca toca tus datos).
//
//   npm run eval:search                 reglas + LLM (si LLM_PROVIDER está configurado)
//   npm run eval:search -- --detalle    además lista los errores de cada consulta
//
// Con LLM_PROVIDER=ollama y EMBEDDINGS_PROVIDER=ollama corre sin gastar cuota.
// Mide: acierto por campo, consultas exactas, recall@5, latencia y costo estimado.
import "../tests/helpers/tempdb.js";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { seed } from "./seed-demo.js";
import { parseRules } from "../lib/search/rules.js";
import { filtersSchema, fold } from "../lib/search/filters.js";
import { runSearch, _clearSearchCaches } from "../lib/search/search.js";
import { embedPending } from "../lib/search/embeddings.js";
import { extractWithLlm, llmConfig, embeddingsConfig, embeddingsEnabled, llmEnabled } from "../lib/search/providers.js";
import { _setUfFetch } from "../lib/uf.js";

export const EVALS = JSON.parse(readFileSync(new URL("../tests/search-evals.json", import.meta.url), "utf8"));
export const FIELDS = ["operacion", "tipo", "comuna", "precio_min", "precio_max", "moneda", "dormitorios_min", "banos_min", "superficie_min", "caracteristicas"];

// Referencia de Workers AI (neurons por millón de tokens, llama-3.1-8b-instruct-fp8-fast).
const NEURONS_IN = 4119;
const NEURONS_OUT = 34868;
const FREE_NEURONS_PER_DAY = 10000;

function sameFeatures(expected, got) {
  if (!Array.isArray(got) || got.length !== expected.length) return false;
  const pool = got.map(fold);
  return expected.every((item) => {
    const options = item.split("|").map(fold);
    const i = pool.findIndex((g) => options.some((o) => g === o || g.includes(o) || o.includes(g)));
    if (i === -1) return false;
    pool.splice(i, 1);
    return true;
  });
}

function sameValue(field, expected, got) {
  if (expected === undefined || got === undefined) return expected === got;
  if (field === "caracteristicas") return sameFeatures(expected, got);
  if (typeof expected === "number") return Math.abs(expected - got) <= Math.abs(expected) * 0.01;
  return expected === got;
}

// Compara campo a campo. Solo cuenta los campos esperados o extraídos (no los ausentes en ambos).
export function scoreFilters(expected, got, opcionales = []) {
  const fields = {};
  for (const field of FIELDS) {
    if (opcionales.includes(field)) continue;
    if (field === "moneda" && !expected.precio_min && !expected.precio_max) continue;
    if (expected[field] === undefined && got[field] === undefined) continue;
    fields[field] = sameValue(field, expected[field], got[field]);
  }
  return { fields, exact: Object.values(fields).every(Boolean) };
}

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const p95 = (xs) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil(xs.length * 0.95) - 1)] : 0);

let refById = null;
export async function prepare() {
  delete process.env.CMF_API_KEY;
  process.env.UF_CLP = String(EVALS.uf_clp);
  _setUfFetch(async () => {
    throw new Error("UF fija para el eval");
  });
  const ids = await seed(JSON.parse(readFileSync(new URL("../tests/fixtures/properties.json", import.meta.url), "utf8")));
  refById = Object.fromEntries(Object.entries(ids).map(([ref, id]) => [id, ref]));
  if (embeddingsEnabled()) await embedPending();
}

// method: "reglas" | "llm"
export async function evaluate(method) {
  _clearSearchCaches();
  const rows = [];
  for (const c of EVALS.consultas) {
    const t0 = performance.now();
    let filtros;
    let scored;
    let fallo = null;
    let usage = null;
    if (method === "reglas") {
      filtros = parseRules(c.q);
      scored = filtros;
    } else {
      try {
        const out = await extractWithLlm(c.q);
        usage = out.usage;
        const parsed = filtersSchema.safeParse(out.raw);
        if (!parsed.success) throw Object.assign(new Error(parsed.error.message), { reason: "respuesta_invalida" });
        filtros = parsed.data;
        scored = filtros;
      } catch (err) {
        fallo = err.reason || "error";
        scored = {}; // para el acierto de filtros, un fallo cuenta como error
        filtros = parseRules(c.q); // para el recall, igual que en producción: cae a reglas
      }
    }
    const interpretMs = performance.now() - t0;
    const { resultados } = await runSearch(filtros);
    const totalMs = performance.now() - t0;
    const top5 = resultados.slice(0, 5).map((r) => refById[r.id]);
    const { fields, exact } = scoreFilters(c.filtros, scored, c.opcionales);
    const recall = c.relevantes.length ? c.relevantes.filter((r) => top5.includes(r)).length / c.relevantes.length : null;
    rows.push({ q: c.q, fields, exact, recall, top5, expected: c.relevantes, interpretMs, totalMs, fallo, usage, got: scored });
  }
  return summarize(rows);
}

function summarize(rows) {
  const perField = {};
  for (const field of FIELDS) {
    const values = rows.map((r) => r.fields[field]).filter((v) => v !== undefined);
    if (values.length) perField[field] = { ok: values.filter(Boolean).length, total: values.length };
  }
  const all = rows.flatMap((r) => Object.values(r.fields));
  const recalls = rows.map((r) => r.recall).filter((r) => r !== null);
  const usages = rows.map((r) => r.usage).filter((u) => u && u.input !== null);
  return {
    rows,
    perField,
    fieldAccuracy: all.filter(Boolean).length / all.length,
    exactRate: rows.filter((r) => r.exact).length / rows.length,
    recallAt5: avg(recalls),
    interpretAvg: avg(rows.map((r) => r.interpretMs)),
    interpretP95: p95(rows.map((r) => r.interpretMs)),
    totalAvg: avg(rows.map((r) => r.totalMs)),
    fallos: rows.filter((r) => r.fallo).length,
    tokensIn: usages.length ? avg(usages.map((u) => u.input)) : null,
    tokensOut: usages.length ? avg(usages.map((u) => u.output ?? 0)) : null,
  };
}

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const ms = (x) => `${Math.round(x)} ms`;

function costLabel(result, config) {
  if (!config) return "$0 (sin LLM)";
  if (config.provider === "ollama") return "$0 (local)";
  if (result.tokensIn === null) return "$0 (plan gratis)";
  if (config.provider === "workers-ai") {
    const neurons = (result.tokensIn * NEURONS_IN + result.tokensOut * NEURONS_OUT) / 1e6;
    return `$0 (plan gratis) · ≈${neurons.toFixed(1)} neurons → ~${Math.floor(FREE_NEURONS_PER_DAY / neurons)} búsquedas/día`;
  }
  return "$0 (plan gratis)";
}

export function table(results) {
  const names = Object.keys(results);
  const head = `| Métrica | ${names.join(" | ")} |\n|---|${names.map(() => "---:").join("|")}|`;
  const line = (label, fn) => `| ${label} | ${names.map((n) => fn(results[n])).join(" | ")} |`;
  const lines = [
    line("Filtros correctos (todos los campos)", (r) => pct(r.fieldAccuracy)),
    line("Consultas con todos los filtros correctos", (r) => pct(r.exactRate)),
    ...FIELDS.map((f) =>
      line(`  · ${f}`, (r) => (r.perField[f] ? `${pct(r.perField[f].ok / r.perField[f].total)} (${r.perField[f].ok}/${r.perField[f].total})` : "—"))
    ),
    line("Recall@5", (r) => pct(r.recallAt5)),
    line("Latencia de interpretación (prom. / p95)", (r) => `${ms(r.interpretAvg)} / ${ms(r.interpretP95)}`),
    line("Latencia total de la búsqueda (prom.)", (r) => ms(r.totalAvg)),
    line("Fallos del LLM (cae a reglas)", (r) => (r.method === "llm" ? `${r.fallos}/${r.rows.length}` : "—")),
    line("Tokens por consulta (entrada / salida)", (r) => (r.tokensIn === null ? "—" : `${Math.round(r.tokensIn)} / ${Math.round(r.tokensOut)}`)),
    line("Costo por consulta", (r) => r.cost),
  ];
  return [head, ...lines].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const detail = process.argv.includes("--detalle");
  const llm = llmEnabled() ? llmConfig() : null;
  const emb = embeddingsConfig();
  console.log(`Eval de búsqueda: ${EVALS.consultas.length} consultas, ${emb ? `embeddings ${emb.provider}/${emb.model}` : "orden por palabras (sin embeddings)"}, UF fija $${EVALS.uf_clp}`);
  await prepare();

  const results = {};
  const rules = await evaluate("reglas");
  results["Parser por reglas"] = { ...rules, method: "reglas", cost: "$0" };
  if (llm) {
    console.log(`Consultando ${llm.provider}/${llm.model}…`);
    const llmResult = await evaluate("llm");
    results[`LLM (${llm.provider}: ${llm.model})`] = { ...llmResult, method: "llm", cost: costLabel(llmResult, llm) };
  } else {
    console.log("Sin LLM_PROVIDER: solo se evalúa el parser por reglas.");
  }

  console.log(`\n${table(results)}\n`);
  if (detail) {
    for (const [name, r] of Object.entries(results)) {
      console.log(`\n## ${name}: consultas con errores`);
      for (const row of r.rows) {
        const wrong = Object.entries(row.fields).filter(([, ok]) => !ok).map(([f]) => f);
        if (wrong.length || (row.recall !== null && row.recall < 1) || row.fallo) {
          console.log(`- "${row.q}"${row.fallo ? ` [fallo: ${row.fallo}]` : ""}`);
          if (wrong.length) console.log(`    campos: ${wrong.join(", ")} → ${JSON.stringify(row.got)}`);
          if (row.recall !== null && row.recall < 1) console.log(`    top5: ${row.top5.join(", ")} (esperadas: ${row.expected.join(", ")})`);
        }
      }
    }
  }
  // PGlite deja el proceso abierto: se cierra explícitamente.
  process.exit(0);
}
