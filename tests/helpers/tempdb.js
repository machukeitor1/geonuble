// Importar antes que lib/db.js: deja la base PGlite y las fotos en una carpeta
// temporal (nunca en .data/ ni public/uploads/ del proyecto) y la borra al salir.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const TMP = mkdtempSync(path.join(tmpdir(), "geonuble-test-"));

process.chdir(TMP);
delete process.env.VERCEL;
delete process.env.DATABASE_URL;
process.on("exit", () => {
  process.chdir(ROOT);
  try { rmSync(TMP, { recursive: true, force: true }); } catch { /* el SO limpia tmp */ }
});
