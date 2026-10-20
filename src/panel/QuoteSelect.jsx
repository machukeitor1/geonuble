import { useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../lib/useApi";
import { formatPrice, propertyLocation, STATUS_LABELS } from "../lib/format";

function QuoteSelect() {
  const { data, error, loading } = useApi("properties?all=1");
  const [search, setSearch] = useState("");

  const term = search.trim().toLowerCase();
  const list = (data || [])
    .filter((p) => p.status !== "draft")
    .filter((p) => !term || `${p.id} ${p.title} ${p.address} ${p.commune} ${p.type}`.toLowerCase().includes(term));

  return (
    <>
      <div className="panel-header">
        <div>
          <h1>Nueva cotización</h1>
          <p>Elige la propiedad que quieres cotizar.</p>
        </div>
        <input
          type="search"
          className="search-input"
          placeholder="Buscar por nombre, código o comuna"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar propiedad"
        />
      </div>

      {error && <p className="alert alert-error">{error}</p>}
      {loading && <p className="muted">Cargando…</p>}
      {data && list.length === 0 && (
        <div className="card">
          <p>{term ? "No hay propiedades que coincidan con la búsqueda." : "Aún no hay propiedades publicadas para cotizar."}</p>
        </div>
      )}

      <div className="property-pick">
        {list.map((p) => (
          <Link key={p.id} to={`/panel/cotizar/${p.id}`}>
            {p.images[0] ? <img src={p.images[0].thumb} alt="" /> : <span className="noimg">Sin fotos</span>}
            <div>
              <strong>{p.title}</strong>
              <span className="muted">
                #{p.id} · {propertyLocation(p) || p.type}
              </span>
              <br />
              <span>{formatPrice(p.price, p.currency)}</span>
              {p.status === "sold" && <span className="badge badge-sold"> {STATUS_LABELS.sold}</span>}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

export default QuoteSelect;
