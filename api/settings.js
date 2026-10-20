import { handle, json, readJson, text } from "../lib/http.js";
import { query } from "../lib/db.js";
import { requireAdmin } from "../lib/auth.js";

// Datos de la empresa que aparecen en el sitio y en las cotizaciones.
const KEYS = ["company_name", "phone", "whatsapp", "email", "address", "hours", "website", "about"];

async function readSettings() {
  const rows = await query("SELECT key, value FROM settings");
  const settings = Object.fromEntries(KEYS.map((k) => [k, ""]));
  for (const { key, value } of rows) if (KEYS.includes(key)) settings[key] = value;
  settings.company_name ||= "Geoñuble Propiedades";
  return settings;
}

export const GET = handle(async () => json(await readSettings()));

export const PUT = handle(async (request) => {
  await requireAdmin(request);
  const body = await readJson(request);
  for (const key of KEYS) {
    if (key in body) {
      await query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, text(body[key], 2000)]
      );
    }
  }
  return json(await readSettings());
});
