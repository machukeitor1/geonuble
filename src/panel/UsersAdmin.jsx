import { useState } from "react";
import { useAuth } from "../context/contexts";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";

const EMPTY = { name: "", email: "", phone: "", position: "Corredor de Propiedades", role: "broker", active: true, password: "" };

function UserForm({ initial, isSelf, onSaved, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial, password: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const isNew = !initial?.id;

  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api(isNew ? "users" : `users?id=${initial.id}`, { method: isNew ? "POST" : "PUT", body: form });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>{isNew ? "Nuevo usuario" : `Editar: ${initial.name}`}</h2>
      <p className="muted">Estos datos de contacto aparecen en las cotizaciones que genera el corredor.</p>
      {error && <p className="alert alert-error">{error}</p>}
      <div className="form-grid">
        <label className="field">
          Nombre completo *
          <input value={form.name} onChange={set("name")} required />
        </label>
        <label className="field">
          Email *
          <input type="email" value={form.email} onChange={set("email")} required />
        </label>
        <label className="field">
          Teléfono
          <input type="tel" value={form.phone} onChange={set("phone")} placeholder="+56 9 1234 5678" />
        </label>
        <label className="field">
          Cargo
          <input value={form.position} onChange={set("position")} />
        </label>
        <label className="field">
          Rol
          <select value={form.role} onChange={set("role")} disabled={isSelf}>
            <option value="broker">Corredor (solo cotiza)</option>
            <option value="admin">Administrador y corredor</option>
          </select>
        </label>
        <label className="field">
          {isNew ? "Contraseña *" : "Nueva contraseña"}
          <input
            type="password"
            value={form.password}
            onChange={set("password")}
            required={isNew}
            minLength={8}
            autoComplete="new-password"
          />
          <small>{isNew ? "Mínimo 8 caracteres" : "Déjala vacía para no cambiarla"}</small>
        </label>
        {!isSelf && (
          <label className="check">
            <input type="checkbox" checked={form.active} onChange={set("active")} />
            Usuario activo (puede iniciar sesión)
          </label>
        )}
      </div>
      <div className="btn-row" style={{ marginTop: "1.2rem" }}>
        <button className="btn" disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function UsersAdmin() {
  const { user: me } = useAuth();
  const { data, error, reload } = useApi("users");
  const [editing, setEditing] = useState(null); // null | {} (nuevo) | usuario
  const [actionError, setActionError] = useState("");

  async function remove(user) {
    if (!confirm(`¿Eliminar a ${user.name}? Sus cotizaciones quedarán sin corredor asignado.`)) return;
    try {
      await api(`users?id=${user.id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  }

  return (
    <>
      <div className="panel-header">
        <div>
          <h1>Corredores y usuarios</h1>
          <p>Administra quién puede entrar al panel y sus datos de contacto.</p>
        </div>
        {!editing && (
          <button type="button" className="btn" onClick={() => setEditing({})}>
            + Nuevo usuario
          </button>
        )}
      </div>

      {(error || actionError) && <p className="alert alert-error">{error || actionError}</p>}

      {editing && (
        <UserForm
          key={editing.id ?? "new"}
          initial={editing}
          isSelf={editing.id === me.id}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}

      {data && (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Contacto</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                    <div className="muted">{u.position}</div>
                  </td>
                  <td>
                    {u.email}
                    <div className="muted">{u.phone || "Sin teléfono"}</div>
                  </td>
                  <td>
                    <span className={`badge ${u.role === "admin" ? "badge-admin" : ""}`}>
                      {u.role === "admin" ? "Admin + corredor" : "Corredor"}
                    </span>
                  </td>
                  <td>{u.active ? "Activo" : <span className="muted">Inactivo</span>}</td>
                  <td>
                    <div className="btn-row">
                      <button type="button" className="btn btn-outline btn-small" onClick={() => setEditing(u)}>
                        Editar
                      </button>
                      {u.id !== me.id && (
                        <button type="button" className="btn btn-danger btn-small" onClick={() => remove(u)}>
                          Eliminar
                        </button>
                      )}
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

export default UsersAdmin;
