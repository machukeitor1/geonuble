import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PropertyCard from "../components/PropertyCard";
import { api } from "../lib/api";
import { usePageTitle } from "../lib/usePageTitle";
import { COMUNAS, TYPES, formatPrice } from "../lib/format";
import "./Properties.css";
import "./AiSearch.css";

const MAX_Q = 300;
const number = new Intl.NumberFormat("es-CL");

// Cómo se muestra y edita cada filtro entendido.
const FIELDS = {
  operacion: { label: "Operación", options: [["venta", "Venta"], ["arriendo", "Arriendo"]] },
  tipo: { label: "Tipo", options: TYPES.map((t) => [t, t]) },
  comuna: { label: "Comuna", options: COMUNAS.map((c) => [c, c]) },
  precio_min: { label: "Desde", type: "number", show: (v, f) => formatPrice(v, f.moneda || "CLP") },
  precio_max: { label: "Hasta", type: "number", show: (v, f) => formatPrice(v, f.moneda || "CLP") },
  moneda: { label: "Moneda", options: [["CLP", "Pesos"], ["UF", "UF"]] },
  dormitorios_min: { label: "Dormitorios", type: "number", show: (v) => `${v} o más` },
  banos_min: { label: "Baños", type: "number", show: (v) => `${v} o más` },
  superficie_min: { label: "Superficie", type: "number", show: (v) => `${number.format(v)} m² o más` },
  texto_semantico: { label: "Descripción", type: "text" },
};

const METODOS = {
  llm: "Entendido con IA",
  reglas: "Interpretado con reglas",
  filtros: "Filtros editados",
};

function Chip({ name, value, filters, onChange, onRemove }) {
  const field = FIELDS[name];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const shown = field.show
    ? field.show(value, filters)
    : field.options?.find(([v]) => v === value)?.[1] ?? value;

  function apply(e) {
    e.preventDefault();
    const next = field.type === "number" ? Number(draft) : draft;
    if (field.type === "number" && !(next > 0 || (next === 0 && name.endsWith("_min")))) return;
    if (field.type === "text" && !String(next).trim()) return onRemove();
    setEditing(false);
    onChange(next);
  }

  if (editing) {
    return (
      <form className="chip chip-editing" onSubmit={apply}>
        <span>{field.label}</span>
        {field.options ? (
          <select value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus aria-label={field.label}>
            {field.options.map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        ) : (
          <input
            type={field.type}
            value={draft}
            min={field.type === "number" ? 0 : undefined}
            step="any"
            maxLength={field.type === "text" ? MAX_Q : undefined}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            aria-label={field.label}
          />
        )}
        <button type="submit">Aplicar</button>
        <button type="button" className="chip-cancel" onClick={() => setEditing(false)}>Cancelar</button>
      </form>
    );
  }

  return (
    <span className="chip">
      <button type="button" className="chip-value" onClick={() => { setDraft(value); setEditing(true); }} aria-label={`Editar ${field.label}: ${shown}`}>
        <span>{field.label}:</span> {shown}
      </button>
      <button type="button" className="chip-remove" onClick={onRemove} aria-label={`Quitar ${field.label}`}>×</button>
    </span>
  );
}

function AiSearch() {
  usePageTitle("Búsqueda con IA");
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get("q") || "";
  const [text, setText] = useState(q);
  const [state, setState] = useState({ loading: false, error: null, data: null });

  const run = useCallback(async (body) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api("search", { method: "POST", body });
      setState({ loading: false, error: null, data });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    setText(q);
    if (q.trim()) run({ q });
  }, [q, run]);

  function submit(e) {
    e.preventDefault();
    const value = text.trim();
    if (value) navigate(`/buscar?q=${encodeURIComponent(value)}`);
  }

  const filters = state.data?.filtros_aplicados || {};
  // Al editar o quitar un chip se busca de nuevo con los filtros (sin llamar al LLM).
  const update = (next) => run({ filtros: { texto_semantico: "", ...next } });
  const setFilter = (name, value) => update({ ...filters, [name]: value });
  const removeFilter = (name) => {
    const next = { ...filters };
    delete next[name];
    if (name === "precio_min" || name === "precio_max") {
      if (!next.precio_min && !next.precio_max) delete next.moneda;
    }
    update(next);
  };
  const removeFeature = (feature) =>
    update({ ...filters, caracteristicas: filters.caracteristicas.filter((c) => c !== feature) });

  const chips = Object.keys(FIELDS).filter((k) => filters[k] !== undefined && filters[k] !== "");
  const data = state.data;

  return (
    <div className="ai-search-page">
      <div className="page-header">
        <div className="container">
          <h1>Busca con tus palabras</h1>
          <p>Describe lo que buscas y te mostramos las propiedades que mejor calzan.</p>
        </div>
      </div>

      <div className="container">
        <form className="ai-search-form" onSubmit={submit} role="search">
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_Q}
            placeholder="Ej: casa de 3 dormitorios en Chillán con patio, hasta 120 millones"
            aria-label="Describe la propiedad que buscas"
          />
          <button type="submit" disabled={state.loading || !text.trim()}>
            {state.loading ? "Buscando…" : "Buscar"}
          </button>
        </form>

        {!q && !data && (
          <p className="status-message">
            Escribe qué buscas: tipo de propiedad, comuna, dormitorios, presupuesto o cómo te la imaginas.
          </p>
        )}

        {state.error && (
          <div className="ai-search-error" role="alert">
            <p>{state.error}</p>
            {q && <button type="button" onClick={() => run({ q })}>Reintentar</button>}
          </div>
        )}

        {data && (
          <section className={state.loading ? "ai-search-results is-loading" : "ai-search-results"} aria-busy={state.loading}>
            <div className="ai-search-understood">
              <p className="ai-search-label">
                Lo que entendimos <span className="ai-search-method">{METODOS[data.metodo] || data.metodo}</span>
              </p>
              {chips.length || filters.caracteristicas?.length ? (
                <div className="chips">
                  {chips.map((name) => (
                    <Chip
                      key={`${name}-${filters[name]}`}
                      name={name}
                      value={filters[name]}
                      filters={filters}
                      onChange={(v) => setFilter(name, v)}
                      onRemove={() => removeFilter(name)}
                    />
                  ))}
                  {filters.caracteristicas?.map((c) => (
                    <span className="chip" key={`c-${c}`}>
                      <span className="chip-value chip-static"><span>Con:</span> {c}</span>
                      <button type="button" className="chip-remove" onClick={() => removeFeature(c)} aria-label={`Quitar ${c}`}>×</button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="ai-search-note">No encontramos filtros concretos; mostramos lo más parecido a tu descripción.</p>
              )}
              {data.relajados.length > 0 && (
                <p className="ai-search-note">Había pocas coincidencias, así que ampliamos: {data.relajados.join(" y ")}.</p>
              )}
              {data.uf && (filters.precio_min || filters.precio_max) && (
                <p className="ai-search-note">
                  UF considerada: ${number.format(data.uf.valor)}{data.uf.fecha ? ` (${data.uf.fecha})` : ""}.
                </p>
              )}
              {data.avisos.map((a) => (
                <p className="ai-search-note ai-search-warning" key={a}>{a}</p>
              ))}
            </div>

            {data.resultados.length === 0 ? (
              <div className="empty-state">
                <h2>No encontramos propiedades con esos criterios</h2>
                <p>Prueba quitando algún filtro o escríbenos y te avisamos cuando tengamos algo así.</p>
              </div>
            ) : (
              <>
                <p className="ai-search-count">
                  {data.resultados.length} propiedad{data.resultados.length === 1 ? "" : "es"}
                </p>
                <div className="properties-grid">
                  {data.resultados.map((p) => (
                    <PropertyCard key={p.id} property={p} />
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {state.loading && !data && <p className="status-message">Buscando propiedades…</p>}
      </div>
    </div>
  );
}

export default AiSearch;
