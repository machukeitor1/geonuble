// Búsqueda con IA (pública): POST { q } o POST { filtros } (chips editados, sin LLM).
import { handle, json, readJson, HttpError } from "../lib/http.js";
import { filtersSchema } from "../lib/search/filters.js";
import { search } from "../lib/search/search.js";

const MAX_Q = 300;
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 20;
// Rate limit simple por IP, en memoria (en Vercel vale por instancia).
const hits = new Map();

function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return (forwarded && forwarded.split(",")[0].trim()) || request.headers.get("x-real-ip") || "local";
}

function rateLimit(ip) {
  const now = Date.now();
  if (hits.size > 5000) for (const [key, v] of hits) if (v.until < now) hits.delete(key);
  const entry = hits.get(ip);
  if (!entry || entry.until < now) {
    hits.set(ip, { count: 1, until: now + WINDOW_MS });
    return;
  }
  if (++entry.count > MAX_PER_WINDOW) throw new HttpError(429, "Demasiadas búsquedas seguidas. Intenta en un minuto.");
}

export function _resetRateLimit() {
  hits.clear();
}

export const POST = handle(async (request) => {
  rateLimit(clientIp(request));
  const body = await readJson(request);

  if (body.filtros !== undefined) {
    const parsed = filtersSchema.safeParse(body.filtros);
    if (!parsed.success) throw new HttpError(400, "Filtros inválidos");
    const { _llm, ...result } = await search({ filtros: parsed.data });
    return json(result);
  }

  if (typeof body.q !== "string" || !body.q.trim()) throw new HttpError(400, "Escribe qué estás buscando");
  if (body.q.length > MAX_Q) throw new HttpError(400, `La búsqueda puede tener hasta ${MAX_Q} caracteres`);
  const { _llm, ...result } = await search({ q: body.q.trim() });
  return json(result);
});
