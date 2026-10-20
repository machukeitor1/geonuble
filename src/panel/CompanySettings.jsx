import { useState } from "react";
import { useSettings } from "../context/contexts";
import { api } from "../lib/api";

const FIELDS = [
  ["company_name", "Nombre de la empresa"],
  ["phone", "Teléfono"],
  ["whatsapp", "WhatsApp", "Con código de país, ej: +56 9 1234 5678"],
  ["email", "Email de contacto"],
  ["address", "Dirección"],
  ["website", "Sitio web", "Aparece en el pie de las cotizaciones"],
];

function CompanySettings() {
  const settings = useSettings();
  if (!settings.loaded) return <p className="muted">Cargando…</p>;
  return <SettingsForm settings={settings} />;
}

function SettingsForm({ settings }) {
  const [form, setForm] = useState(settings);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await api("settings", { method: "PUT", body: form });
      settings.update(saved);
      setMessage({ type: "ok", text: "Datos guardados." });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="panel-header">
        <div>
          <h1>Datos de la empresa</h1>
          <p>Se muestran en el sitio web (contacto y pie de página) y en el encabezado de las cotizaciones.</p>
        </div>
        <button className="btn" disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
      {message.text && <p className={`alert alert-${message.type === "ok" ? "ok" : "error"}`}>{message.text}</p>}
      <section className="card">
        <div className="form-grid">
          {FIELDS.map(([key, label, hint]) => (
            <label className="field" key={key}>
              {label}
              <input value={form[key] || ""} onChange={set(key)} />
              {hint && <small>{hint}</small>}
            </label>
          ))}
          <label className="field">
            Horarios
            <textarea rows={3} value={form.hours || ""} onChange={set("hours")} placeholder={"Lun - Vie: 9:00 - 19:00\nSáb: 10:00 - 14:00"} />
            <small>Una línea por horario</small>
          </label>
          <label className="field">
            Descripción breve
            <textarea rows={3} value={form.about || ""} onChange={set("about")} />
            <small>Texto del pie de página</small>
          </label>
        </div>
      </section>
    </form>
  );
}

export default CompanySettings;
