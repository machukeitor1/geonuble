// Carga las propiedades ficticias de tests/fixtures/properties.json en la base
// LOCAL (PGlite en .data/) para probar la búsqueda. Nunca toca Neon.
// Uso: npm run seed:demo   (si hay EMBEDDINGS_PROVIDER, también genera embeddings)
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { query } from "../lib/db.js";
import { embedPending } from "../lib/search/embeddings.js";
import { embeddingsEnabled } from "../lib/search/providers.js";

if (process.env.DATABASE_URL) {
  console.error("seed:demo es solo para la base local: quita DATABASE_URL para usarlo.");
  process.exit(1);
}

const fixtures = JSON.parse(await readFile(new URL("../tests/fixtures/properties.json", import.meta.url), "utf8"));

export async function seed(rows = fixtures) {
  const ids = {};
  for (const p of rows) {
    const [{ id }] = await query(
      `INSERT INTO properties (title, description, operation, type, price, currency, commune, bedrooms, bathrooms,
        parking, built_area, total_area, features, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14) RETURNING id`,
      [p.title, p.description, p.operation, p.type, p.price, p.currency, p.commune, p.bedrooms ?? null,
        p.bathrooms ?? null, p.parking ?? null, p.built_area ?? null, p.total_area ?? null,
        JSON.stringify(p.features || []), p.status || "published"]
    );
    ids[p.ref] = id;
  }
  return ids;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [{ n }] = await query("SELECT count(*)::int AS n FROM properties WHERE title = $1", [fixtures[0].title]);
  if (n > 0) {
    console.log("Las propiedades de demostración ya estaban cargadas.");
  } else {
    await seed();
    console.log(`Cargadas ${fixtures.length} propiedades de demostración.`);
  }
  if (embeddingsEnabled()) {
    const { actualizados } = await embedPending();
    console.log(`Embeddings generados: ${actualizados}.`);
  }
  // PGlite deja el proceso abierto: se cierra explícitamente.
  process.exit(0);
}
