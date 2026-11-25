// Búsqueda híbrida: filtros SQL exactos + orden por similitud de embeddings.
// 1) Interpreta la consulta (LLM con salida estructurada; si no hay o falla, reglas).
// 2) Filtra con SQL parametrizado (solo publicadas). Nunca se concatena texto del usuario.
// 3) Ordena por similitud coseno con texto_semantico, o por palabras, o por fecha.
// 4) Si quedan menos de 3, relaja: precio ±10% y luego características.
import { query } from "../db.js";
import { PROPERTY_FIELDS } from "../schema.js";
import { getUf, convert } from "../uf.js";
import { filtersSchema, fold } from "./filters.js";
import { parseRules } from "./rules.js";
import { extractWithLlm, embedTexts, embeddingsEnabled, llmEnabled, ProviderError } from "./providers.js";
import { toVector } from "./embeddings.js";

const LIMIT = 20;
const MIN_RESULTS = 3;
const AREA_BY_TOTAL = ["Parcela", "Terreno", "Campo / Agrícola"];
const FOLD_SQL = (col) => `translate(lower(${col}), 'áéíóúüñ', 'aeiouun')`;

// Caché simple en memoria con vencimiento y tamaño máximo (por instancia).
function cache(ttlMs, max) {
  const map = new Map();
  return {
    get(key) {
      const hit = map.get(key);
      if (!hit || hit.until < Date.now()) return map.delete(key) && undefined;
      return hit.value;
    },
    set(key, value) {
      if (map.size >= max) map.delete(map.keys().next().value);
      map.set(key, { value, until: Date.now() + ttlMs });
    },
    clear: () => map.clear(),
  };
}
const responses = cache(5 * 60 * 1000, 500);
const queryEmbeddings = cache(60 * 60 * 1000, 1000);
export function _clearSearchCaches() {
  responses.clear();
  queryEmbeddings.clear();
}

const AVISOS = {
  sin_configuracion: "Búsqueda por reglas: no hay un modelo de IA configurado.",
  cuota: "Búsqueda por reglas: se agotó la cuota diaria del modelo de IA.",
  respuesta_invalida: "Búsqueda por reglas: el modelo de IA devolvió una respuesta inválida.",
  error: "Búsqueda por reglas: el modelo de IA no respondió.",
};

// Devuelve { filtros, metodo, avisos, llm? }. Solo `q` viaja al proveedor.
export async function interpret(q) {
  if (!llmEnabled()) return { filtros: parseRules(q), metodo: "reglas", avisos: [] };
  try {
    const { raw, usage, provider, model } = await extractWithLlm(q);
    const parsed = filtersSchema.safeParse(raw);
    if (!parsed.success) throw new ProviderError("respuesta_invalida", parsed.error.message);
    return { filtros: parsed.data, metodo: "llm", avisos: [], llm: { provider, model, usage } };
  } catch (err) {
    const reason = err instanceof ProviderError ? err.reason : "error";
    console.error(`Búsqueda: LLM no disponible (${reason}): ${err.message}`);
    return { filtros: parseRules(q), metodo: "reglas", avisos: [AVISOS[reason] || AVISOS.error] };
  }
}

async function embedQuery(text) {
  const key = fold(text);
  const hit = queryEmbeddings.get(key);
  if (hit) return hit;
  const [vector] = await embedTexts([text]);
  queryEmbeddings.set(key, vector);
  return vector;
}

// Construye el WHERE con parámetros. `relax`: { price: bool, features: bool }
function buildWhere(f, uf, relax) {
  const params = [];
  const p = (value) => {
    params.push(value);
    return `$${params.length}`;
  };
  const where = ["status = 'published'"];

  if (f.operacion === "venta") where.push("operation = 'Venta'");
  if (f.operacion === "arriendo") where.push("operation IN ('Arriendo', 'Arriendo temporal')");
  if (f.tipo) where.push(`type = ${p(f.tipo)}`);
  if (f.comuna) where.push(`${FOLD_SQL("commune")} = ${p(fold(f.comuna))}`);
  if (f.dormitorios_min) where.push(`bedrooms >= ${p(f.dormitorios_min)}`);
  if (f.banos_min) where.push(`bathrooms >= ${p(f.banos_min)}`);
  if (f.superficie_min) {
    where.push(
      `(CASE WHEN type = ANY(${p(AREA_BY_TOTAL)}) THEN total_area ELSE COALESCE(built_area, total_area) END) >= ${p(f.superficie_min)}`
    );
  }

  if (f.precio_min || f.precio_max) {
    const min = f.precio_min && (relax.price ? f.precio_min * 0.9 : f.precio_min);
    const max = f.precio_max && (relax.price ? f.precio_max * 1.1 : f.precio_max);
    // Compara en la moneda de cada propiedad; sin UF solo en la misma moneda. USD queda fuera.
    const byCurrency = ["UF", "CLP"]
      .map((currency) => {
        const lo = min ? convert(min, f.moneda, currency, uf) : null;
        const hi = max ? convert(max, f.moneda, currency, uf) : null;
        if ((min && lo === null) || (max && hi === null)) return null;
        const parts = [`currency = '${currency}'`];
        if (lo !== null) parts.push(`price >= ${p(lo)}`);
        if (hi !== null) parts.push(`price <= ${p(hi)}`);
        return `(${parts.join(" AND ")})`;
      })
      .filter(Boolean);
    where.push(`price IS NOT NULL AND (${byCurrency.join(" OR ")})`);
  }

  if (f.caracteristicas && !relax.features) {
    for (const c of f.caracteristicas) {
      const like = p(`%${fold(c).replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
      const parking = fold(c).startsWith("estacionamiento") ? " OR parking > 0" : "";
      where.push(`(${FOLD_SQL("features::text")} LIKE ${like} OR ${FOLD_SQL("description")} LIKE ${like}${parking})`);
    }
  }
  return { where: where.join(" AND "), params };
}

async function runQuery(f, uf, relax, vector) {
  const { where, params } = buildWhere(f, uf, relax);
  let score = "NULL::float";
  let order = "featured DESC, created_at DESC";
  if (vector) {
    params.push(toVector(vector));
    const v = `$${params.length}::vector`;
    score = `CASE WHEN embedding IS NULL THEN NULL ELSE 1 - (embedding <=> ${v}) END`;
    order = `embedding <=> ${v} ASC NULLS LAST, created_at DESC`;
  } else if (f.texto_semantico) {
    // Sin embeddings: cuenta cuántas palabras del texto aparecen (búsqueda por texto simple).
    const words = [...new Set(fold(f.texto_semantico).split(/\s+/).filter((w) => w.length > 3))].slice(0, 8);
    if (words.length) {
      const hay = `${FOLD_SQL("title")} || ' ' || ${FOLD_SQL("description")} || ' ' || ${FOLD_SQL("features::text")}`;
      const terms = words.map((w) => {
        params.push(`%${w}%`);
        return `(CASE WHEN ${hay} LIKE $${params.length} THEN 1 ELSE 0 END)`;
      });
      score = `(${terms.join(" + ")})::float / ${words.length}`;
      order = `${score} DESC, created_at DESC`;
    }
  }
  return query(
    `SELECT ${PROPERTY_FIELDS}, ${score} AS score FROM properties WHERE ${where} ORDER BY ${order} LIMIT ${LIMIT}`,
    params
  );
}

// Busca con filtros ya interpretados. Devuelve { resultados, relajados, avisos, uf }.
export async function runSearch(filtros) {
  const avisos = [];
  const needsUf = filtros.precio_min || filtros.precio_max;
  const uf = needsUf ? await getUf() : null;
  if (needsUf && !uf) avisos.push("Sin valor de la UF: los precios solo se comparan en la misma moneda.");

  let vector = null;
  if (filtros.texto_semantico && embeddingsEnabled()) {
    try {
      vector = await embedQuery(filtros.texto_semantico);
    } catch (err) {
      console.error("Búsqueda: sin embedding de la consulta:", err.message);
      avisos.push("Orden por palabras: el servicio de embeddings no respondió.");
    }
  }

  const relajados = [];
  const relax = { price: false, features: false };
  let resultados = await runQuery(filtros, uf, relax, vector);
  if (resultados.length < MIN_RESULTS && (filtros.precio_min || filtros.precio_max)) {
    relax.price = true;
    relajados.push("precio ±10%");
    resultados = await runQuery(filtros, uf, relax, vector);
  }
  if (resultados.length < MIN_RESULTS && filtros.caracteristicas) {
    relax.features = true;
    relajados.push("características");
    resultados = await runQuery(filtros, uf, relax, vector);
  }

  return {
    resultados: resultados.map((r) => ({ ...r, score: r.score === null ? null : Number(Number(r.score).toFixed(4)) })),
    relajados,
    avisos,
    uf: uf && { valor: uf.valor, fecha: uf.fecha, fuente: uf.fuente },
  };
}

// Punto de entrada: { q } (interpreta) o { filtros } (chips editados: sin LLM).
export async function search({ q, filtros }) {
  const key = q !== undefined ? `q:${fold(q).replace(/\s+/g, " ")}` : `f:${JSON.stringify(Object.entries(filtros).sort())}`;
  const hit = responses.get(key);
  if (hit) return { ...hit, cache: true };

  const started = Date.now();
  const interpreted = q !== undefined ? await interpret(q) : { filtros, metodo: "filtros", avisos: [] };
  const found = await runSearch(interpreted.filtros);
  const response = {
    filtros_aplicados: interpreted.filtros,
    metodo: interpreted.metodo,
    relajados: found.relajados,
    avisos: [...interpreted.avisos, ...found.avisos],
    uf: found.uf,
    resultados: found.resultados,
    ms: Date.now() - started,
  };
  responses.set(key, response);
  return { ...response, cache: false, _llm: interpreted.llm };
}
