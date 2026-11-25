// Plan B de la búsqueda: extrae filtros de una consulta en español con reglas
// (sin LLM). Se usa si no hay proveedor configurado, si el LLM falla o si se
// agota la cuota. Devuelve el mismo formato que filtersSchema.
import { COMUNAS, fold, filtersSchema } from "./filters.js";

const WORD_NUMBERS = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 };
const NUM = String.raw`(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?|una|uno|un|dos|tres|cuatro|cinco|seis)`;
const END = String.raw`(?![a-z0-9])`;
// Para dormitorios y baños se permite un dígito después ("3d2b").
const END_ROOMS = String.raw`(?![a-z])`;

// "3.500" -> 3500, "3,5" -> 3.5, "1.5" -> 1.5, "tres" -> 3
export function parseNumber(raw) {
  if (raw in WORD_NUMBERS) return WORD_NUMBERS[raw];
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) return Number(raw.replace(/\./g, "").replace(",", "."));
  return Number(raw.replace(",", "."));
}

const TYPE_RULES = [
  ["Campo / Agrícola", /\b(campos?|fundos?|predios? agricolas?|terrenos? agricolas?)\b/],
  ["Departamento", /\b(departamentos?|deptos?|dptos?|depas?)\b/],
  ["Parcela", /\bparcelas?(?: de agrado)?\b/],
  ["Terreno", /\b(terrenos?|sitios?|lotes?)\b/],
  ["Casa", /\bcasas?\b/],
  ["Oficina", /\boficinas?\b/],
  ["Local comercial", /\blocal(?:es)?(?: comercial(?:es)?)?\b/],
  ["Hostal / Comercial", /\bhostal(?:es)?\b/],
  ["Bodega", /(?<!con )\bbodegas?\b/],
];

const FEATURE_RULES = [
  ["patio", /\bpatios?\b/],
  ["piscina", /\bpiscinas?\b/],
  ["quincho", /\bquinchos?\b/],
  ["jardin", /\bjardin(?:es)?\b/],
  ["terraza", /\bterrazas?\b/],
  ["balcon", /\bbalcon(?:es)?\b/],
  ["estacionamiento", /\b(estacionamientos?|garage|garaje|cochera)\b/],
  ["bodega", /\bcon bodegas?\b/],
  ["calefaccion", /\bcalefaccion\b/],
  ["chimenea", /\b(chimenea|salamandra|combustion lenta)\b/],
  ["amoblado", /\b(amoblad[oa]s?|amueblad[oa]s?)\b/],
  ["mascotas", /\b(mascotas?|pet friendly)\b/],
  ["ascensor", /\bascensor\b/],
  ["conserjeria", /\bconserjeria\b/],
  ["gimnasio", /\bgimnasio\b/],
  ["pozo", /\bpozo\b/],
  ["riego", /\b(riego|derechos? de agua)\b/],
  // La etiqueta es también lo que se busca en características y descripción (LIKE),
  // por eso se usan raíces que calzan con cómo se escriben los avisos.
  ["condominio", /\b(condominios?|cond\.? cerrado|barrio cerrado)\b/],
  ["frutal", /\b(frutal(?:es)?|huerto frutal)\b/],
  ["huerto", /\bhuertos?\b/],
  ["sauna", /\bsaunas?\b/],
  ["jacuzzi", /\b(jacuzzis?|hidromasaje)\b/],
  ["tinaja", /\b(tinajas?|tina caliente)\b/],
  ["aire acondicionado", /\b(aire acondicionado|climatizad[oa]s?)\b/],
  ["solar", /\b(paneles? solares?|termo solar|energia solar)\b/],
  ["galpon", /\bgalpon(?:es)?\b/],
  ["invernadero", /\binvernaderos?\b/],
  ["suite", /\b(en suite|suite)\b/],
  ["logia", /\blogias?\b/],
  ["alarma", /\balarmas?\b/],
  ["porton", /\bporton(?:es)?(?: electrico)?\b/],
  ["agua potable", /\bagua potable\b/],
  ["alcantarillado", /\balcantarillado\b/],
];

const OPERATION_RULES = [
  ["arriendo", /\b(arriendos?|arrendar|arrienda|arriendan|alquiler|alquilar|arrendamiento)\b/],
  ["venta", /\b(venta|vendo|vender|venden|comprar|compra|compro)\b/],
];

const STOPWORDS = new Set(
  ("quiero busco buscamos necesito necesitamos me gustaria ojala una un uno unos unas de del en con para que " +
    "sea y o la el los las al por a se tenga tener tiene ojala algo tipo propiedad propiedades donde hay " +
    "como mas menos muy maximo minimo hasta desde entre sobre bajo precio valor presupuesto quisiera " +
    "comuna region nuble disponible disponibles cerca? lo su sus mi mis").split(/\s+/).filter((w) => !w.endsWith("?"))
);

// Palabras de relación que, sin nada más, no describen la propiedad.
const DANGLING = new Set(["cerca", "cercano", "cercana", "junto", "frente", "lejos", "alrededor", "dentro", "fuera", "aprox", "aproximadamente", "idealmente"]);

const MONEY_UNIT =String.raw`(millones|millon|mills?|mm|palos|m|mil|lucas|uf|pesos|clp)`;

function money(numRaw, unit, dollar) {
  const n = parseNumber(numRaw);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (unit === "uf") return { value: n, currency: "UF" };
  if (["millones", "millon", "mill", "mills", "mm", "palos", "m"].includes(unit)) return { value: n * 1e6, currency: "CLP" };
  if (unit === "mil" || unit === "lucas") return { value: n * 1e3, currency: "CLP" };
  if (unit === "pesos" || unit === "clp" || dollar) return { value: n, currency: "CLP" };
  return null; // número sin unidad: no se interpreta como precio
}

export function parseRules(q) {
  let text = ` ${fold(q).replace(/[¡!¿?;:()"'«»]/g, " ").replace(/\s+/g, " ")} `;
  const raw = {};
  // Reemplaza lo reconocido por espacios para que no se lea dos veces.
  // Prueba cada coincidencia hasta que fn la acepte (fn devuelve false para descartar).
  const take = (regex, fn) => {
    for (const match of text.matchAll(new RegExp(regex.source, "g"))) {
      if (fn(match) === false) continue;
      text = text.slice(0, match.index) + " ".repeat(match[0].length) + text.slice(match.index + match[0].length);
      return true;
    }
    return false;
  };

  // Superficie (antes que el precio: "200 m2" no es dinero)
  take(new RegExp(String.raw`(?:de |con |al menos |minimo |sobre |mas de )?${NUM}\s*(m2|m²|mt2|mts2|mts|metros cuadrados|metros)${END}`), (m) => {
    raw.superficie_min = parseNumber(m[1]);
  }) ||
    take(new RegExp(String.raw`(?:de |con |al menos |minimo |sobre |mas de )?${NUM}\s*(hectareas?|ha|has|hás)${END}`), (m) => {
      raw.superficie_min = parseNumber(m[1]) * 10000;
    });

  take(new RegExp(String.raw`(?:al menos |minimo |mas de )?${NUM}\s*(?:dormitorios?|dorms?|habitaciones?|piezas?|recamaras?|d)${END_ROOMS}`), (m) => {
    raw.dormitorios_min = parseNumber(m[1]);
  });
  take(new RegExp(String.raw`(?:al menos |minimo |mas de )?${NUM}\s*(?:banos?|b)${END_ROOMS}`), (m) => {
    raw.banos_min = parseNumber(m[1]);
  });

  // Precio: rango, máximo, mínimo o monto suelto con unidad (se toma como máximo).
  const setPrice = (key, m) => {
    if (!m) return false;
    raw[key] = m.value;
    raw.moneda = m.currency;
  };
  const amount = String.raw`(\$\s*)?${NUM}\s*${MONEY_UNIT}?${END}`;
  const rangeOk = take(
    new RegExp(String.raw`(?:entre|de)\s+(\$\s*)?${NUM}\s*${MONEY_UNIT}?\s*(?:y|a|-)\s*(\$\s*)?${NUM}\s*${MONEY_UNIT}${END}`),
    (m) => {
      const unit = m[6];
      const lo = money(m[2], m[3] || unit, m[1]);
      const hi = money(m[5], unit, m[4]);
      if (!lo || !hi) return false;
      raw.precio_min = lo.value;
      raw.precio_max = hi.value;
      raw.moneda = hi.currency;
    }
  );
  if (!rangeOk) {
    const ufFirst = String.raw`uf\s*${NUM}${END}`;
    take(new RegExp(String.raw`(?:hasta|maximo|max|menos de|bajo|no mas de|tope|tope de|presupuesto(?: de)?|por debajo de)\s+(?:de\s+)?(?:${amount}|${ufFirst})`), (m) =>
      setPrice("precio_max", m[2] ? money(m[2], m[3], m[1]) : money(m[4], "uf"))
    ) ||
      take(new RegExp(String.raw`(?:desde|sobre|mas de|minimo|al menos|por sobre|por encima de)\s+(?:${amount}|${ufFirst})`), (m) =>
        setPrice("precio_min", m[2] ? money(m[2], m[3], m[1]) : money(m[4], "uf"))
      ) ||
      take(new RegExp(String.raw`(?:${amount}|${ufFirst})`), (m) =>
        setPrice("precio_max", m[2] ? money(m[2], m[3], m[1]) : money(m[4], "uf"))
      );
  }

  for (const [type, regex] of TYPE_RULES) if (!raw.tipo && take(regex, () => {})) raw.tipo = type;

  const comunas = [...COMUNAS].sort((a, b) => b.length - a.length);
  for (const comuna of comunas) {
    if (take(new RegExp(String.raw`\b${fold(comuna)}\b`), () => {})) {
      raw.comuna = comuna;
      break;
    }
  }

  for (const [op, regex] of OPERATION_RULES) if (!raw.operacion && take(regex, () => {})) raw.operacion = op;

  const features = [];
  for (const [feature, regex] of FEATURE_RULES) if (take(regex, () => {})) features.push(feature);
  if (features.length) raw.caracteristicas = features;

  // Lo que queda (sin palabras vacías ni números sueltos) es la parte descriptiva.
  const leftover = text
    .replace(/[,.$\-/]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w) && !/^\d+$/.test(w));
  // "cerca", "junto", etc. solo describen algo si queda el lugar al que se refieren
  // ("cerca universidad"); solos (porque el lugar era la comuna) no aportan nada.
  raw.texto_semantico = leftover.every((w) => DANGLING.has(w)) ? "" : leftover.join(" ");

  const parsed = filtersSchema.safeParse(raw);
  return parsed.success ? parsed.data : { texto_semantico: raw.texto_semantico };
}
