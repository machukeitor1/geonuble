// Tests del parser por reglas (plan B de la búsqueda con IA).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRules, parseNumber } from "../lib/search/rules.js";
import { filtersSchema } from "../lib/search/filters.js";

const cases = [
  [
    "casa de 3 dormitorios en Chillán con patio, hasta 120 millones",
    { tipo: "Casa", dormitorios_min: 3, comuna: "Chillán", caracteristicas: ["patio"], precio_max: 120e6, moneda: "CLP" },
  ],
  ["depto en arriendo en chillan viejo 2d 1b hasta 450 mil", {
    tipo: "Departamento", operacion: "arriendo", comuna: "Chillán Viejo", dormitorios_min: 2, banos_min: 1, precio_max: 450000, moneda: "CLP",
  }],
  ["parcela de agrado en Pinto de 5.000 m2, máximo 3.500 UF", {
    tipo: "Parcela", comuna: "Pinto", superficie_min: 5000, precio_max: 3500, moneda: "UF",
  }],
  ["comprar casa entre 2.000 y 3.000 UF en San Carlos", {
    operacion: "venta", tipo: "Casa", comuna: "San Carlos", precio_min: 2000, precio_max: 3000, moneda: "UF",
  }],
  ["terreno de 1 hectárea en Coihueco", { tipo: "Terreno", comuna: "Coihueco", superficie_min: 10000 }],
  ["casa tres dormitorios dos baños con quincho y piscina en Quillón", {
    tipo: "Casa", dormitorios_min: 3, banos_min: 2, caracteristicas: ["piscina", "quincho"], comuna: "Quillón",
  }],
  ["local comercial en el centro de San Carlos", { tipo: "Local comercial", comuna: "San Carlos" }],
  ["casa desde 90 millones en Bulnes", { tipo: "Casa", comuna: "Bulnes", precio_min: 90e6, moneda: "CLP" }],
  ["departamento $95.000.000 en Chillan", { tipo: "Departamento", comuna: "Chillán", precio_max: 95e6, moneda: "CLP" }],
  ["campo con derechos de agua en Ñiquén", { tipo: "Campo / Agrícola", comuna: "Ñiquén", caracteristicas: ["riego"] }],
  ["casa con bodega y estacionamiento", { tipo: "Casa", caracteristicas: ["bodega", "estacionamiento"] }],
  ["3d2b en chillan 100m2", { dormitorios_min: 3, banos_min: 2, comuna: "Chillán", superficie_min: 100, texto_semantico: "" }],
  ["bodega en arriendo", { tipo: "Bodega", operacion: "arriendo" }],
];

for (const [q, expected] of cases) {
  test(`reglas: ${q}`, () => {
    const got = parseRules(q);
    for (const [key, value] of Object.entries(expected)) {
      if (Array.isArray(value)) assert.deepEqual([...(got[key] || [])].sort(), [...value].sort(), key);
      else assert.equal(got[key], value, key);
    }
  });
}

test("reglas: lo descriptivo queda en texto_semantico", () => {
  const got = parseRules("casa luminosa y tranquila cerca del centro en Chillán");
  assert.equal(got.tipo, "Casa");
  assert.equal(got.comuna, "Chillán");
  assert.match(got.texto_semantico, /luminosa/);
  assert.match(got.texto_semantico, /tranquila/);
  assert.match(got.texto_semantico, /centro/);
  assert.doesNotMatch(got.texto_semantico, /casa|chillan/);
});

test("reglas: un número sin unidad no se toma como precio", () => {
  const got = parseRules("casa número 25 en Yungay");
  assert.equal(got.precio_max, undefined);
  assert.equal(got.comuna, "Yungay");
});

test("reglas: texto vacío o sin filtros no falla", () => {
  assert.deepEqual(parseRules(""), { texto_semantico: "" });
  assert.equal(parseRules("algo bonito").texto_semantico, "algo bonito".replace("algo ", ""));
});

test("parseNumber: separadores chilenos", () => {
  assert.equal(parseNumber("3.500"), 3500);
  assert.equal(parseNumber("120.000.000"), 120000000);
  assert.equal(parseNumber("3,5"), 3.5);
  assert.equal(parseNumber("tres"), 3);
});

test("filtersSchema: rechaza tipo o comuna fuera del catálogo y normaliza", () => {
  assert.equal(filtersSchema.safeParse({ tipo: "castillo", texto_semantico: "" }).success, false);
  assert.equal(filtersSchema.safeParse({ comuna: "Santiago", texto_semantico: "" }).success, false);
  const ok = filtersSchema.parse({ tipo: "casa", comuna: "chillan viejo", precio_max: 120e6, texto_semantico: null, dormitorios_min: null });
  assert.deepEqual(ok, { tipo: "Casa", comuna: "Chillán Viejo", precio_max: 120e6, moneda: "CLP", texto_semantico: "" });
  assert.equal(filtersSchema.safeParse({ precio_min: 10, precio_max: 5, texto_semantico: "" }).success, false);
});

test("reglas: 'cerca' solo (el lugar era la comuna) no queda como descripción", () => {
  assert.equal(parseRules("parcela con piscina cerca de Chillán hasta 150 millones").texto_semantico, "");
  assert.equal(parseRules("casa junto a Bulnes").texto_semantico, "");
  assert.equal(parseRules("depto cerca de la universidad").texto_semantico, "cerca universidad", "con lugar, sí describe");
});
