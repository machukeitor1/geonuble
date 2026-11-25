import { schema, vectorSchema } from "./schema.js";
import { hashPassword } from "./auth.js";

let client;

// Ejecuta una consulta SQL parametrizada y devuelve las filas.
// Con DATABASE_URL usa Neon; sin ella (desarrollo local) usa PGlite en .data/.
export async function query(text, params = []) {
  client ??= createClient().catch((err) => {
    client = undefined;
    throw err;
  });
  const run = await client;
  return run(text, params);
}

async function createClient() {
  if (process.env.DATABASE_URL) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL);
    return (text, params) => sql.query(text, params);
  }

  if (process.env.VERCEL) {
    throw new Error("Falta configurar DATABASE_URL");
  }

  // Nombres en variable para que el empaquetador de Vercel no los incluya.
  const pgliteModule = "@electric-sql/pglite";
  const vectorModule = "@electric-sql/pglite-pgvector";
  const { PGlite } = await import(/* @vite-ignore */ pgliteModule);
  const { vector } = await import(/* @vite-ignore */ vectorModule);
  const { mkdir } = await import("node:fs/promises");
  await mkdir(".data", { recursive: true });
  const db = new PGlite(".data/pglite", { extensions: { vector } });
  const run = async (text, params) => (await db.query(text, params)).rows;
  await setupDatabase(run, (sql) => db.exec(sql));
  return run;
}

// Crea las tablas y, si no hay usuarios, el administrador inicial
// definido en ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME.
export async function setupDatabase(run, exec) {
  await exec(schema);
  await exec(vectorSchema());

  const [{ count }] = await run("SELECT count(*)::int AS count FROM users");
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (count > 0 || !ADMIN_EMAIL || !ADMIN_PASSWORD) return false;

  await run(
    "INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, 'admin')",
    [ADMIN_EMAIL.toLowerCase(), await hashPassword(ADMIN_PASSWORD), ADMIN_NAME || "Administrador"]
  );
  return true;
}
