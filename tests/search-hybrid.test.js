// Unidades del modo complemento: cuándo llamar al LLM y qué aceptar de su respuesta.
import { test } from "node:test";
import assert from "node:assert/strict";
import { unknownWords, mergeFilters } from "../lib/search/hybrid.js";
import { parseRules } from "../lib/search/rules.js";

test("unknownWords: lo descriptivo no llama al LLM; lo que podría ser filtro sí", () => {
  for (const q of ["casa luminosa y tranquila cerca del colegio", "departamento moderno amplio cerca del mall", "parcela con vista a la cordillera", "casa barata para la familia"]) {
    assert.deepEqual(unknownWords(parseRules(q).texto_semantico), [], q);
  }
  assert.deepEqual(unknownWords(parseRules("casa con cava").texto_semantico), ["cava"]);
  assert.deepEqual(unknownWords(parseRules("casa con piscina temperada y cava").texto_semantico), ["temperada", "cava"]);
  assert.deepEqual(unknownWords(""), []);
});

test("mergeFilters: tipo y números del LLM solo llenan vacíos", () => {
  const q = "cabaña de 2 dormitorios en Quillón";
  const rules = { comuna: "Quillón", dormitorios_min: 2, texto_semantico: "cabana" };
  const { filtros, agregados } = mergeFilters(rules, { tipo: "Casa", comuna: "Quillón", dormitorios_min: 3, banos_min: 1 }, q);
  assert.equal(filtros.tipo, "Casa");
  assert.equal(filtros.dormitorios_min, 2, "no pisa lo que entendieron las reglas");
  assert.equal(filtros.banos_min, 1);
  assert.deepEqual(agregados.sort(), ["banos_min", "tipo"]);
});

test("mergeFilters: rechaza comunas, precios y características que no están en la consulta", () => {
  const q = "bodega grande para camiones";
  const rules = { tipo: "Bodega", texto_semantico: "grande camiones" };
  const { filtros, agregados } = mergeFilters(
    rules,
    { comuna: "Chillán", precio_max: 1000, moneda: "UF", caracteristicas: ["estacionamiento", "grande", "acceso para camiones"] },
    q
  );
  assert.deepEqual(agregados, []);
  assert.equal(filtros.comuna, undefined);
  assert.equal(filtros.precio_max, undefined);
  assert.equal(filtros.caracteristicas, undefined);
});

test("mergeFilters: suma características nuevas y las saca del texto descriptivo", () => {
  const q = "casa moderna en cava con patio";
  const rules = parseRules(q);
  const { filtros } = mergeFilters(rules, { caracteristicas: ["patio", "cava"] }, q);
  assert.deepEqual(filtros.caracteristicas, ["patio", "cava"]);
  assert.equal(filtros.texto_semantico, "moderna");
});
