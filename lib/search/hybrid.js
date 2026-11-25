// Modo complemento: las reglas interpretan primero y el LLM solo se consulta si
// quedaron palabras que podrían ser un filtro. De la respuesta del LLM solo se
// aceptan campos que las reglas no encontraron y que se pueden comprobar en el
// texto de la consulta; nunca se reemplaza lo que extrajeron las reglas.
import { fold } from "./filters.js";

// Raíces de palabras que solo describen (ubicación, ambiente, estado, propósito).
// No son filtros: van a texto_semantico y se ordenan con embeddings, sin LLM.
const DESCRIPTIVE = [
  // ubicación y entorno
  "cerca", "centr", "vista", "cordiller", "rio", "laguna", "lago", "mar", "playa", "costa", "montan", "cerro",
  "bosque", "nativ", "naturalez", "verde", "sector", "barrio", "villa", "poblacion", "calle",
  "avenida", "esquina", "junto", "frente", "orilla", "lejos", "afuera", "interior", "urban", "rural", "campo",
  "pueblo", "ciudad", "region", "zona", "norte", "sur", "oriente", "poniente", "ubicad", "ubicacion", "acceso",
  // servicios cercanos
  "universi", "colegio", "escuela", "mall", "supermerc", "comercio", "plaza", "hospital", "clinica",
  "locomocion", "micro", "metro", "terminal", "carretera", "ruta",
  // ambiente y estado
  "tranquil", "silencio", "segur", "lumin", "soleal", "solead", "ampli", "espacio", "grand", "pequen", "chic",
  "acoged", "comod", "bonit", "lind", "hermos", "moderno", "moderna", "nuev", "antigu", "remodel", "restaur",
  "conserv", "buen", "excelente", "ideal", "perfect", "lujo", "sencill", "simple",
  // precio y propósito
  "barat", "econom", "accesible", "oportunidad", "inversion", "invertir", "vivir", "familia", "familiar",
  "estudiant", "vacacion", "veraneo", "descanso", "construir", "constru", "proyecto",
  "agricol", "trabajar", "negocio", "acepta", "algo", "lugar", "todo",
];
const isDescriptive = (word) =>
  DESCRIPTIVE.some((stem) => (stem.length <= 3 ? word === stem : word.startsWith(stem)));

// Palabras que quedaron sin interpretar y no son descriptivas: justifican llamar al LLM.
export function unknownWords(textoSemantico) {
  return fold(textoSemantico)
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w.length > 3 && !/^\d+$/.test(w) && !isDescriptive(w));
}

const qWords = (q) => fold(q).split(/[^a-z0-9]+/).filter(Boolean);
// Una palabra "aparece" en la consulta si comparte los primeros 5 caracteres (plurales, género).
const appearsIn = (word, words) => words.some((w) => w.startsWith(word.slice(0, 5)) || word.startsWith(w.slice(0, 5)));
const hasNumber = (q) => /\d|\b(un|una|uno|dos|tres|cuatro|cinco|seis)\b/.test(fold(q));

// Combina reglas + LLM. Devuelve { filtros, agregados: [campos aceptados del LLM] }.
export function mergeFilters(rules, llm, q) {
  const words = qWords(q);
  const filtros = { ...rules };
  const agregados = [];
  const take = (field, value) => {
    filtros[field] = value;
    agregados.push(field);
  };

  // Tipo: solo si las reglas no lo encontraron (ej. "cabaña", "casona").
  if (!rules.tipo && llm.tipo) take("tipo", llm.tipo);
  // Comuna: solo si su nombre está escrito en la consulta.
  if (!rules.comuna && llm.comuna && fold(q).includes(fold(llm.comuna))) take("comuna", llm.comuna);
  // La operación nunca se toma del LLM: las reglas reconocen todas las palabras que la indican.

  // Números: solo si la consulta tiene números y las reglas no los entendieron.
  if (hasNumber(q)) {
    for (const field of ["dormitorios_min", "banos_min", "superficie_min"]) {
      if (rules[field] === undefined && llm[field] > 0) take(field, llm[field]);
    }
    if (!rules.precio_min && !rules.precio_max && (llm.precio_min || llm.precio_max)) {
      if (llm.precio_min) take("precio_min", llm.precio_min);
      if (llm.precio_max) take("precio_max", llm.precio_max);
      if (llm.moneda) filtros.moneda = llm.moneda;
    }
  }

  // Características: nuevas, de 1 o 2 palabras, no descriptivas y escritas en la consulta.
  const known = new Set((rules.caracteristicas || []).map(fold));
  const extra = (llm.caracteristicas || []).map(fold).filter((c) => {
    const parts = c.split(/\s+/).filter((p) => p.length > 2);
    return (
      !known.has(c) &&
      parts.length > 0 &&
      parts.length <= 2 &&
      !parts.every(isDescriptive) &&
      parts.every((p) => appearsIn(p, words))
    );
  });
  if (extra.length) {
    filtros.caracteristicas = [...(rules.caracteristicas || []), ...extra];
    agregados.push("caracteristicas");
    // Lo que ahora es característica ya no es texto descriptivo.
    filtros.texto_semantico = fold(rules.texto_semantico || "")
      .split(/\s+/)
      .filter((w) => w && !extra.some((c) => c.split(/\s+/).some((p) => appearsIn(p, [w]))))
      .join(" ");
  }
  return { filtros, agregados };
}
