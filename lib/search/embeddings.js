// Embeddings de propiedades. Se recalculan solo si cambió el texto embebido
// (o el modelo): el hash queda en properties.embedding_hash.
import { createHash } from "node:crypto";
import { query } from "../db.js";
import { embedTexts, embeddingsConfig, embeddingsEnabled } from "./providers.js";

const BATCH = 16;

// Título + tipo + comuna + descripción + características (datos públicos del aviso).
export function propertyEmbeddingText(p) {
  const features = Array.isArray(p.features) ? p.features : [];
  return [
    p.title,
    [p.operation, p.type, p.commune && `en ${p.commune}`].filter(Boolean).join(" "),
    p.description,
    features.length ? `Características: ${features.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 8000);
}

const modelId = () => embeddingsConfig()?.model ?? "test";
export const embeddingHash = (text) => createHash("sha256").update(`${modelId()}\n${text}`).digest("hex");
export const toVector = (values) => `[${values.join(",")}]`;

async function store(rows) {
  const vectors = await embedTexts(rows.map((r) => r.text));
  for (let i = 0; i < rows.length; i++) {
    await query("UPDATE properties SET embedding = $1::vector, embedding_hash = $2 WHERE id = $3", [
      toVector(vectors[i]),
      rows[i].hash,
      rows[i].id,
    ]);
  }
}

// Al crear o editar en el gestor. Nunca hace fallar el guardado de la propiedad.
// Devuelve "actualizado" | "sin_cambios" | "desactivado" | "error".
export async function syncPropertyEmbedding(property) {
  if (!embeddingsEnabled()) return "desactivado";
  try {
    const text = propertyEmbeddingText(property);
    const hash = embeddingHash(text);
    const [row] = await query("SELECT embedding_hash FROM properties WHERE id = $1", [property.id]);
    if (row?.embedding_hash === hash) return "sin_cambios";
    await store([{ id: property.id, text, hash }]);
    return "actualizado";
  } catch (err) {
    console.error(`No se pudo generar el embedding de la propiedad ${property.id}:`, err.message);
    return "error";
  }
}

// Para el backfill: genera los embeddings que faltan o quedaron desactualizados.
export async function embedPending({ onProgress } = {}) {
  const all = await query(
    "SELECT id, title, operation, type, commune, description, features, embedding_hash FROM properties ORDER BY id"
  );
  const pending = all
    .map((p) => {
      const text = propertyEmbeddingText(p);
      return { id: p.id, text, hash: embeddingHash(text), current: p.embedding_hash };
    })
    .filter((p) => p.hash !== p.current);
  for (let i = 0; i < pending.length; i += BATCH) {
    await store(pending.slice(i, i + BATCH));
    onProgress?.(Math.min(i + BATCH, pending.length), pending.length);
  }
  return { total: all.length, actualizados: pending.length };
}
