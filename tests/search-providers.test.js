// Tests de los proveedores de LLM y embeddings con fetch simulado (sin red ni cuota).
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { extractWithLlm, embedTexts, ProviderError, SYSTEM_PROMPT } from "../lib/search/providers.js";

const realFetch = globalThis.fetch;
let calls;
const respond = (body, status = 200) => {
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  };
};
const ENV = ["LLM_PROVIDER", "LLM_MODEL", "CF_ACCOUNT_ID", "CF_AI_TOKEN", "GEMINI_API_KEY", "EMBEDDINGS_PROVIDER", "EMBEDDINGS_DIM", "OLLAMA_URL"];

beforeEach(() => {
  calls = [];
  globalThis.fetch = async () => { throw new Error("test sin fetch simulado"); };
  for (const k of ENV) delete process.env[k];
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const Q = "casa en Chillán hasta 120 millones";

test("workers-ai: modo JSON con esquema y solo la consulta como mensaje de usuario", async () => {
  Object.assign(process.env, { LLM_PROVIDER: "workers-ai", CF_ACCOUNT_ID: "acc", CF_AI_TOKEN: "tok" });
  respond({ success: true, result: { response: { tipo: "Casa", texto_semantico: "" }, usage: { prompt_tokens: 700, completion_tokens: 20 } } });
  const out = await extractWithLlm(Q);
  assert.deepEqual(out.raw, { tipo: "Casa", texto_semantico: "" });
  assert.equal(out.model, "@cf/meta/llama-3.1-8b-instruct");
  assert.deepEqual(out.usage, { input: 700, output: 20 });
  const [call] = calls;
  assert.equal(call.url, "https://api.cloudflare.com/client/v4/accounts/acc/ai/run/@cf/meta/llama-3.1-8b-instruct");
  assert.equal(call.headers.Authorization, "Bearer tok");
  assert.equal(call.body.response_format.type, "json_schema");
  assert.deepEqual(call.body.messages, [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: Q },
  ]);
});

test("gemini: Interactions API, texto en steps[].content[]", async () => {
  Object.assign(process.env, { LLM_PROVIDER: "gemini", GEMINI_API_KEY: "g-key" });
  respond({
    status: "completed",
    steps: [{ type: "model_output", content: [{ type: "text", text: '{"comuna":"Chillán","texto_semantico":""}' }] }],
    usage: { total_input_tokens: 650, total_output_tokens: 15 },
  });
  const out = await extractWithLlm(Q);
  assert.deepEqual(out.raw, { comuna: "Chillán", texto_semantico: "" });
  assert.equal(calls[0].headers["x-goog-api-key"], "g-key");
  assert.equal(calls[0].body.input, Q);
  assert.equal(calls[0].body.response_format.mime_type, "application/json");
});

test("ollama: format con esquema y URL configurable", async () => {
  Object.assign(process.env, { LLM_PROVIDER: "ollama", OLLAMA_URL: "http://127.0.0.1:9999" });
  respond({ message: { content: '{"tipo":"Parcela","texto_semantico":""}' }, prompt_eval_count: 1, eval_count: 2 });
  const out = await extractWithLlm(Q);
  assert.equal(out.raw.tipo, "Parcela");
  assert.equal(calls[0].url, "http://127.0.0.1:9999/api/chat");
  assert.equal(calls[0].body.format.type, "object");
});

test("errores: 429 es cuota, sin claves es sin_configuracion, JSON roto es respuesta_invalida", async () => {
  await assert.rejects(extractWithLlm(Q), (e) => e instanceof ProviderError && e.reason === "sin_configuracion");
  Object.assign(process.env, { LLM_PROVIDER: "workers-ai", CF_ACCOUNT_ID: "a", CF_AI_TOKEN: "t" });
  respond({ errors: [{ message: "daily free allocation of neurons exceeded" }] }, 429);
  await assert.rejects(extractWithLlm(Q), (e) => e.reason === "cuota");
  respond({ errors: [{ message: "you have used up your daily neurons" }] }, 400);
  await assert.rejects(extractWithLlm(Q), (e) => e.reason === "cuota");
  respond({ result: { response: "esto no es json" } });
  await assert.rejects(extractWithLlm(Q), (e) => e.reason === "respuesta_invalida");
  respond({ errors: [{ message: "JSON Mode couldn't be met" }] }, 500);
  await assert.rejects(extractWithLlm(Q), (e) => e.reason === "error");
});

test("embeddings: bge-m3 en Workers AI y validación de dimensión", async () => {
  Object.assign(process.env, { EMBEDDINGS_PROVIDER: "workers-ai", CF_ACCOUNT_ID: "acc", CF_AI_TOKEN: "tok", EMBEDDINGS_DIM: "4" });
  respond({ result: { shape: [2, 4], data: [[1, 0, 0, 0], [0, 1, 0, 0]] } });
  const vectors = await embedTexts(["a", "b"]);
  assert.equal(vectors.length, 2);
  assert.match(calls[0].url, /@cf\/baai\/bge-m3$/);
  assert.deepEqual(calls[0].body, { text: ["a", "b"] });
  respond({ result: { data: [[1, 0, 0]] } });
  await assert.rejects(embedTexts(["a"]), (e) => e.reason === "respuesta_invalida");
});

test("embeddings: ollama /api/embed", async () => {
  Object.assign(process.env, { EMBEDDINGS_PROVIDER: "ollama", EMBEDDINGS_DIM: "2" });
  respond({ embeddings: [[0.1, 0.2]] });
  assert.deepEqual(await embedTexts(["x"]), [[0.1, 0.2]]);
  assert.deepEqual(calls[0].body, { model: "bge-m3", input: ["x"] });
});
