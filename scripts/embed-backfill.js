// Genera los embeddings de las propiedades que no tienen o que cambiaron.
// Uso: npm run embed:backfill   (lee DATABASE_URL y EMBEDDINGS_* de .env.local)
// Sin DATABASE_URL trabaja sobre la base local (.data/). No recalcula lo que no cambió.
import { embedPending } from "../lib/search/embeddings.js";
import { embeddingsConfig } from "../lib/search/providers.js";

const config = embeddingsConfig();
if (!config) {
  console.error("Falta EMBEDDINGS_PROVIDER (workers-ai u ollama) en .env.local");
  process.exit(1);
}
console.log(`Embeddings con ${config.provider} / ${config.model} en ${process.env.DATABASE_URL ? "Neon" : "la base local"}`);
const { total, actualizados } = await embedPending({
  onProgress: (done, of) => console.log(`  ${done}/${of}`),
});
console.log(`Listo: ${actualizados} de ${total} propiedades actualizadas (el resto no cambió).`);
// PGlite deja el proceso abierto: se cierra explícitamente.
process.exit(0);
