import { useSearchParams } from "react-router-dom";
import PropertyCard from "../components/PropertyCard";
import { useApi } from "../lib/useApi";
import { usePageTitle } from "../lib/usePageTitle";
import "./Properties.css";

function Properties() {
  usePageTitle("Propiedades");
  const { data: properties, error, loading } = useApi("properties");
  const [params, setParams] = useSearchParams();
  const operation = params.get("operacion") || "";
  const type = params.get("tipo") || "";

  const all = properties || [];
  // Incluye el filtro elegido aunque no haya propiedades de ese tipo (ej. desde el buscador de la portada).
  const operations = [...new Set([...all.map((p) => p.operation), operation].filter(Boolean))];
  const types = [...new Set([...all.map((p) => p.type), type].filter(Boolean))];
  const filtered = all.filter((p) => (!operation || p.operation === operation) && (!type || p.type === type));

  function setFilter(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  return (
    <div className="properties-page">
      <div className="page-header">
        <div className="container">
          <h1>Propiedades</h1>
          <p>Descubre nuestras propiedades disponibles en la región de Ñuble</p>
        </div>
      </div>
      <div className="container">
        {loading && <p className="status-message">Cargando propiedades…</p>}
        {error && <p className="status-message">No se pudieron cargar las propiedades. {error}</p>}

        {properties && all.length === 0 && (
          <div className="empty-state">
            <h2>No hay propiedades disponibles</h2>
            <p>Estamos actualizando nuestro catálogo. Vuelve pronto.</p>
          </div>
        )}

        {all.length > 0 && (
          <>
            <div className="properties-filters">
              <label>
                Operación
                <select value={operation} onChange={(e) => setFilter("operacion", e.target.value)}>
                  <option value="">Todas</option>
                  {operations.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
              <label>
                Tipo
                <select value={type} onChange={(e) => setFilter("tipo", e.target.value)}>
                  <option value="">Todos</option>
                  {types.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            {filtered.length === 0 ? (
              <p className="status-message">No hay propiedades con esos filtros.</p>
            ) : (
              <div className="properties-grid">
                {filtered.map((p) => (
                  <PropertyCard key={p.id} property={p} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Properties;
