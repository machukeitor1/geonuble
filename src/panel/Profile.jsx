import { useState } from "react";
import { useAuth } from "../context/contexts";
import { api } from "../lib/api";

function Profile() {
  const { user } = useAuth();
  const [message, setMessage] = useState({ type: "", text: "" });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const { currentPassword, password, confirmPassword } = Object.fromEntries(new FormData(formEl));
    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Las contraseñas nuevas no coinciden." });
      return;
    }
    setSaving(true);
    try {
      await api("users?id=me", { method: "PUT", body: { currentPassword, password } });
      formEl.reset();
      setMessage({ type: "ok", text: "Contraseña actualizada." });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="panel-header">
        <div>
          <h1>Mi perfil</h1>
          <p>Así apareces en las cotizaciones. Para cambiar estos datos, pídeselo al administrador.</p>
        </div>
      </div>

      <section className="card">
        <h2>Datos de contacto</h2>
        <div className="form-grid">
          <div className="field">
            Nombre<span className="muted">{user.name}</span>
          </div>
          <div className="field">
            Cargo<span className="muted">{user.position || "—"}</span>
          </div>
          <div className="field">
            Email<span className="muted">{user.email}</span>
          </div>
          <div className="field">
            Teléfono<span className="muted">{user.phone || "—"}</span>
          </div>
        </div>
      </section>

      <form className="card" onSubmit={handleSubmit}>
        <h2>Cambiar contraseña</h2>
        {message.text && <p className={`alert alert-${message.type === "ok" ? "ok" : "error"}`}>{message.text}</p>}
        <div className="form-grid">
          <label className="field">
            Contraseña actual
            <input type="password" name="currentPassword" autoComplete="current-password" required />
          </label>
          <label className="field">
            Nueva contraseña
            <input type="password" name="password" autoComplete="new-password" minLength={8} required />
          </label>
          <label className="field">
            Repetir nueva contraseña
            <input type="password" name="confirmPassword" autoComplete="new-password" minLength={8} required />
          </label>
        </div>
        <div className="btn-row" style={{ marginTop: "1.2rem" }}>
          <button className="btn" disabled={saving}>
            {saving ? "Guardando…" : "Cambiar contraseña"}
          </button>
        </div>
      </form>
    </>
  );
}

export default Profile;
