import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

// Carga datos de la API: { data, error, loading, reload, setData }.
// Durante una recarga se conservan los datos anteriores.
export function useApi(path) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({ key: null, data: null, error: null });
  const key = path ? `${path}#${version}` : null;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    api(path)
      .then((data) => !cancelled && setState({ key, data, error: null }))
      .catch((err) => !cancelled && setState({ key, data: null, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [path, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback((data) => setState((s) => ({ ...s, data })), []);
  const loading = Boolean(key) && state.key !== key;
  return { data: state.data, error: loading ? null : state.error, loading, reload, setData };
}
