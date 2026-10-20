// Cliente para las funciones de /api.
export async function api(path, { method = "GET", body, headers = {} } = {}) {
  const isFile = body instanceof Blob;
  const res = await fetch(`/api/${path}`, {
    method,
    credentials: "same-origin",
    headers: body && !isFile ? { "Content-Type": "application/json", ...headers } : headers,
    body: isFile ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "No se pudo conectar con el servidor");
  return data;
}
