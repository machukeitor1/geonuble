// Formato común de los filtros de búsqueda: lo producen el LLM y el parser por
// reglas, y lo consumen la consulta SQL y los chips de la interfaz.
import { z } from "zod";
import { TYPES, COMUNAS } from "../../src/lib/format.js";

export { TYPES, COMUNAS };

// Minúsculas y sin tildes (la ñ pasa a n), para comparar texto libre.
export const fold = (value) =>
  String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const canonical = (list) => {
  const map = new Map(list.map((item) => [fold(item), item]));
  return (value) => map.get(fold(value));
};
export const canonicalType = canonical(TYPES);
export const canonicalComuna = canonical(COMUNAS);

const positive = z.number().finite().positive();
const count = z.number().int().min(0).max(50);
const optional = (schema) => schema.nullish().transform((v) => v ?? undefined);

// Esquema estricto: valida lo que devuelve un LLM (o lo que manda el navegador al
// editar los chips). Tipo y comuna deben ser valores que existen en el catálogo.
export const filtersSchema = z
  .object({
    operacion: optional(z.enum(["venta", "arriendo"])),
    tipo: optional(z.string().max(50)).refine((v) => v === undefined || canonicalType(v), "tipo desconocido")
      .transform((v) => (v === undefined ? undefined : canonicalType(v))),
    comuna: optional(z.string().max(50)).refine((v) => v === undefined || canonicalComuna(v), "comuna desconocida")
      .transform((v) => (v === undefined ? undefined : canonicalComuna(v))),
    precio_min: optional(positive),
    precio_max: optional(positive),
    moneda: optional(z.enum(["CLP", "UF"])),
    dormitorios_min: optional(count),
    banos_min: optional(count),
    superficie_min: optional(positive),
    caracteristicas: optional(z.array(z.string().trim().min(1).max(40)).max(8)),
    texto_semantico: optional(z.string().max(300)).transform((v) => (v ?? "").trim()),
  })
  .strip()
  .refine((f) => !(f.precio_min && f.precio_max) || f.precio_min <= f.precio_max, "precio_min > precio_max")
  .transform((f) => {
    // Precio sin moneda: los montos chicos son UF y los grandes, pesos.
    if ((f.precio_min || f.precio_max) && !f.moneda) {
      f.moneda = (f.precio_max ?? f.precio_min) >= 100000 ? "CLP" : "UF";
    }
    if (f.caracteristicas) f.caracteristicas = [...new Set(f.caracteristicas.map(fold))];
    if (!f.caracteristicas?.length) delete f.caracteristicas;
    for (const key of Object.keys(f)) if (f[key] === undefined) delete f[key];
    return f;
  });

// JSON Schema equivalente, para pedir salida estructurada a los LLM.
export const filtersJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    operacion: { type: "string", enum: ["venta", "arriendo"] },
    tipo: { type: "string", enum: TYPES },
    comuna: { type: "string", enum: COMUNAS },
    precio_min: { type: "number" },
    precio_max: { type: "number" },
    moneda: { type: "string", enum: ["CLP", "UF"] },
    dormitorios_min: { type: "integer" },
    banos_min: { type: "integer" },
    superficie_min: { type: "number" },
    caracteristicas: { type: "array", items: { type: "string" } },
    texto_semantico: { type: "string" },
  },
  required: ["texto_semantico"],
};

export const FILTER_KEYS = Object.keys(filtersJsonSchema.properties);
