// Valor de la UF en pesos para convertir precios UF <-> CLP en la búsqueda.
// La UF cambia una vez al día: se guarda en memoria y en la tabla settings
// (sobrevive a reinicios de Vercel) y se refresca si tiene más de 12 horas.
// Fuentes: CMF (oficial, requiere CMF_API_KEY gratis) o mindicador.cl (sin clave).
// Si la fuente falla: último valor guardado; si no hay, UF_CLP; si no, null.
import { query } from "./db.js";

const MAX_AGE_MS = 12 * 60 * 60 * 1000;
const SETTINGS_KEY = "uf_clp";
let memory = null;
let inflight = null;
let fetchImpl = (...args) => fetch(...args);

// Solo para tests: reemplaza fetch y limpia el caché en memoria.
export function _setUfFetch(fn) {
  fetchImpl = fn;
  memory = null;
  inflight = null;
}

const plausible = (n) => Number.isFinite(n) && n > 10000 && n < 500000;

async function fromCmf(apiKey) {
  const url = `https://api.cmfchile.cl/api-sbifv3/recursos_api/uf?apikey=${encodeURIComponent(apiKey)}&formato=json`;
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`CMF respondió ${res.status}`);
  const [item] = (await res.json()).UFs || [];
  // La CMF usa formato chileno: "41.405,45"
  const valor = Number(String(item?.Valor).replace(/\./g, "").replace(",", "."));
  if (!plausible(valor)) throw new Error("CMF: valor de UF inválido");
  return { valor, fecha: item.Fecha, fuente: "CMF" };
}

async function fromMindicador() {
  const res = await fetchImpl("https://mindicador.cl/api/uf", { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`mindicador.cl respondió ${res.status}`);
  const [item] = (await res.json()).serie || [];
  const valor = Number(item?.valor);
  if (!plausible(valor)) throw new Error("mindicador.cl: valor de UF inválido");
  return { valor, fecha: String(item.fecha).slice(0, 10), fuente: "mindicador.cl" };
}

async function readStored() {
  try {
    const [row] = await query("SELECT value FROM settings WHERE key = $1", [SETTINGS_KEY]);
    const stored = row ? JSON.parse(row.value) : null;
    return stored && plausible(stored.valor) ? stored : null;
  } catch {
    return null;
  }
}

async function refresh() {
  const stored = await readStored();
  if (stored && Date.now() - stored.fetchedAt < MAX_AGE_MS) return stored;
  try {
    const fresh = process.env.CMF_API_KEY ? await fromCmf(process.env.CMF_API_KEY) : await fromMindicador();
    const entry = { ...fresh, fetchedAt: Date.now() };
    await query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [SETTINGS_KEY, JSON.stringify(entry)]
    ).catch(() => {});
    return entry;
  } catch (err) {
    console.error("No se pudo actualizar la UF:", err.message);
    if (stored) return { ...stored, desactualizada: true };
    const env = Number(process.env.UF_CLP);
    return plausible(env) ? { valor: env, fecha: null, fuente: "UF_CLP", fetchedAt: Date.now() } : null;
  }
}

// Devuelve { valor, fecha, fuente } o null si no hay forma de saber la UF.
export async function getUf() {
  if (memory && Date.now() - memory.fetchedAt < MAX_AGE_MS && !memory.desactualizada) return memory;
  inflight ??= refresh().finally(() => {
    inflight = null;
  });
  const entry = await inflight;
  if (entry) memory = entry;
  return entry && { valor: entry.valor, fecha: entry.fecha, fuente: entry.fuente };
}

// Convierte un monto entre UF y CLP. Devuelve null si no se puede.
export function convert(amount, from, to, uf) {
  if (amount === undefined || amount === null) return null;
  if (from === to) return amount;
  if (!uf?.valor) return null;
  if (from === "UF" && to === "CLP") return amount * uf.valor;
  if (from === "CLP" && to === "UF") return amount / uf.valor;
  return null;
}
