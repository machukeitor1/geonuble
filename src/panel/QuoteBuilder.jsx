import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth, useSettings } from "../context/contexts";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import { formatPrice, propertyLocation } from "../lib/format";
import { downloadQuotePdf, QUOTE_SECTIONS } from "../lib/quotePdf";

const DEFAULT_SECTIONS = QUOTE_SECTIONS.map((s) => s.id);

function QuoteBuilder() {
  const { id } = useParams();
  const { user } = useAuth();
  const settings = useSettings();
  const { data: property, error, loading } = useApi(`properties?id=${encodeURIComponent(id)}`);
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [clientName, setClientName] = useState("");
  const [validity, setValidity] = useState(15);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState({ state: "idle", text: "" });

  if (loading) return <p className="muted">Cargando…</p>;
  if (error) return <p className="alert alert-error">{error}</p>;

  const hasPoint = property.lat != null && property.lng != null;
  const available = QUOTE_SECTIONS.filter((s) => {
    if (s.id === "map") return hasPoint;
    if (s.id === "photo") return property.images.length > 0;
    if (s.id === "gallery") return property.images.length > 1;
    return true;
  });

  const toggle = (sectionId) =>
    setSections((list) => (list.includes(sectionId) ? list.filter((s) => s !== sectionId) : [...list, sectionId]));

  async function generate() {
    setStatus({ state: "working", text: "Generando PDF…" });
    const chosen = sections.filter((s) => available.some((a) => a.id === s));
    try {
      const quote = await api("quotes", {
        method: "POST",
        body: { property_id: property.id, sections: chosen, client_name: clientName, notes, validity_days: validity },
      });
      await downloadQuotePdf({ property, quote, settings, sections: chosen });
      setStatus({ state: "done", text: `Cotización N° ${String(quote.id).padStart(4, "0")} descargada.` });
    } catch (err) {
      setStatus({ state: "error", text: err.message });
    }
  }

  return (
    <>
      <div className="panel-header">
        <div>
          <h1>Cotizar propiedad</h1>
          <p>Elige qué información llevará el PDF.</p>
        </div>
        <Link to="/panel/cotizar" className="btn btn-outline">
          Cambiar propiedad
        </Link>
      </div>

      <div className="quote-layout">
        <div>
          <section className="card">
            <h2>Datos de la cotización</h2>
            <div className="form-grid">
              <label className="field">
                Cliente (opcional)
                <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nombre del cliente" />
              </label>
              <label className="field">
                Vigencia (días)
                <input type="number" min="1" max="365" value={validity} onChange={(e) => setValidity(e.target.value)} />
              </label>
              <label className="field field-wide">
                Observaciones (opcional)
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Condiciones, forma de pago, visitas…" />
              </label>
            </div>
          </section>

          <section className="card">
            <div className="panel-header" style={{ marginBottom: "0.8rem" }}>
              <h2 style={{ margin: 0 }}>Contenido del PDF</h2>
              <div className="btn-row">
                <button type="button" className="btn btn-outline btn-small" onClick={() => setSections(DEFAULT_SECTIONS)}>
                  Todo
                </button>
                <button type="button" className="btn btn-outline btn-small" onClick={() => setSections([])}>
                  Nada
                </button>
              </div>
            </div>
            <div className="section-list">
              {available.map((s) => (
                <label className="check" key={s.id}>
                  <input type="checkbox" checked={sections.includes(s.id)} onChange={() => toggle(s.id)} />
                  {s.label}
                </label>
              ))}
            </div>
            {!hasPoint && (
              <p className="muted" style={{ marginBottom: 0 }}>
                Para incluir el mapa, marca la ubicación de la propiedad en su ficha.
              </p>
            )}
          </section>
        </div>

        <aside className="card quote-summary">
          {property.images[0] && <img src={property.images[0].thumb} alt="" />}
          <strong>{property.title}</strong>
          <p className="muted" style={{ margin: "0.3rem 0" }}>
            #{property.id} · {propertyLocation(property) || property.type}
          </p>
          <p style={{ margin: "0 0 1rem", fontWeight: 700 }}>{formatPrice(property.price, property.currency)}</p>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Corredor: {user.name}
            {!user.phone && " (sin teléfono registrado)"}
          </p>
          {status.text && (
            <p className={`alert ${status.state === "error" ? "alert-error" : "alert-ok"}`} role="status">
              {status.text}
            </p>
          )}
          <button type="button" className="btn" style={{ width: "100%" }} onClick={generate} disabled={status.state === "working"}>
            {status.state === "working" ? "Generando…" : "Generar PDF"}
          </button>
        </aside>
      </div>
    </>
  );
}

export default QuoteBuilder;
