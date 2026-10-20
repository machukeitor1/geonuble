import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import { formatPrice, STATUS_LABELS } from "../lib/format";

function PropertiesAdmin() {
  const { data, error, loading, reload } = useApi("properties?all=1");
  const [actionError, setActionError] = useState("");

  async function remove(property) {
    if (!confirm(`¿Eliminar "${property.title}" y todas sus fotos? Esta acción no se puede deshacer.`)) return;
    try {
      await api(`properties?id=${property.id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  }

  return (
    <>
      <div className="panel-header">
        <div>
          <h1>Propiedades</h1>
          <p>Solo las propiedades “Publicadas” aparecen en el sitio web.</p>
        </div>
        <Link to="/panel/propiedades/nueva" className="btn">
          + Nueva propiedad
        </Link>
      </div>

      {(error || actionError) && <p className="alert alert-error">{error || actionError}</p>}
      {loading && <p className="muted">Cargando…</p>}

      {data && data.length === 0 && (
        <div className="card">
          <p>Aún no hay propiedades. Crea la primera con “Nueva propiedad”.</p>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Foto</th>
                <th>Propiedad</th>
                <th>Precio</th>
                <th>Estado</th>
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.images[0] ? (
                      <img className="table-thumb" src={p.images[0].thumb} alt="" />
                    ) : (
                      <div className="table-thumb" />
                    )}
                  </td>
                  <td>
                    <strong>{p.title}</strong>
                    <div className="muted">
                      #{p.id} · {p.operation} · {p.type}
                      {p.featured && " · ★ Destacada"}
                    </div>
                  </td>
                  <td>{formatPrice(p.price, p.currency)}</td>
                  <td>
                    <span className={`badge badge-${p.status}`}>{STATUS_LABELS[p.status]}</span>
                  </td>
                  <td>
                    <div className="btn-row">
                      <Link to={`/panel/propiedades/${p.id}`} className="btn btn-outline btn-small">
                        Editar
                      </Link>
                      <Link to={`/panel/cotizar/${p.id}`} className="btn btn-outline btn-small">
                        Cotizar
                      </Link>
                      <button type="button" className="btn btn-danger btn-small" onClick={() => remove(p)}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default PropertiesAdmin;
