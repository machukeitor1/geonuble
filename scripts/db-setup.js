// Crea las tablas en Neon y el administrador inicial.
// Uso: npm run db:setup   (lee DATABASE_URL y ADMIN_* de .env.local)
import { neon } from "@neondatabase/serverless";
import { setupDatabase } from "../lib/db.js";

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL. Cópiala desde el panel de Neon a .env.local");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const run = (text, params = []) => sql.query(text, params);
// Neon ejecuta una sentencia por llamada.
const exec = async (script) => {
  for (const statement of script.split(";").map((s) => s.trim()).filter(Boolean)) {
    await sql.query(statement);
  }
};

const created = await setupDatabase(run, exec);
console.log("Tablas listas.");
console.log(
  created
    ? `Administrador creado: ${process.env.ADMIN_EMAIL}`
    : "No se creó administrador (ya hay usuarios o faltan ADMIN_EMAIL/ADMIN_PASSWORD)."
);
