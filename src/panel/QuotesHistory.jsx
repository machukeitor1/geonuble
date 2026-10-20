import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth, useSettings } from "../context/contexts";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import { formatDate } from "../lib/format";
import { downloadQuotePdf } from "../lib/quotePdf";

function QuotesHistory() {
  const { user } = useAuth();
  const settings = useSettings();
  const { data, error } = useApi("quotes");
  const [working, setWorking] = useState(null);
  const [actionError, setActionError] = useState("");
  const isAdmin = user.role === "admin";

  // Vuelve a generar el PDF con los datos actuales de la propiedad.
  async function redownload(quote) {
    setWorking(quote.id);
    setActionError("");
    try {
      const property = await api(`properties?id=${quote.property_id}`);
      await downloadQuotePdf({ property, quote, settings, sections: quote.sections });
    } catch (err) {
      setActionError(err.message);
    } finally {
      setWorking(null);
    }
  }

  return (
    <>
      <div className="panel-header">
        <div>
          <h1>{isAdmin ? "Cotizaciones" : "Mis cotizaciones"}</h1>
          <p>Al volver a descargar, el PDF se genera con los datos actuales de la propiedad.</p>
        </div>
        <Link to="/panel/cotizar" className="btn">
          + Nueva cotización
        </Link>
      </div>

      {(error || actionError) && <p className="alert alert-error">{error || actionError}</p>}
      {data?.length === 0 && (
        <div className="card">
          <p>Aún no hay cotizaciones.</p>
        </div>
      )}

      {data?.length > 0 && (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Fecha</th>
                <th>Propiedad</th>
                <th>Cliente</th>
                {isAdmin && <th>Corredor</th>}
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((q) => (
                <tr key={q.id}>
                  <td>{String(q.id).padStart(4, "0")}</td>
                  <td>{formatDate(q.created_at)}</td>
                  <td>{q.property_title || <span className="muted">Propiedad eliminada</span>}</td>
                  <td>{q.client_name || <span className="muted">—</span>}</td>
                  {isAdmin && <td>{q.broker_name || <span className="muted">—</span>}</td>}
                  <td>
                    {q.property_id && (
                      <button
                        type="button"
                        className="btn btn-outline btn-small"
                        onClick={() => redownload(q)}
                        disabled={working !== null}
                      >
                        {working === q.id ? "Generando…" : "Descargar PDF"}
                      </button>
                    )}
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

export default QuotesHistory;
