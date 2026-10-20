import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import { formatDate } from "../lib/format";
import { desktopAlertsSupported } from "./useMessageAlerts";

// Botón para recibir avisos del sistema operativo aunque el panel esté en otra pestaña.
function DesktopAlertsButton() {
  const [permission, setPermission] = useState(() => (desktopAlertsSupported() ? Notification.permission : "unsupported"));

  if (permission === "unsupported") return null;
  if (permission === "granted") return <span className="badge badge-published">Avisos de escritorio activados</span>;
  if (permission === "denied") {
    return <span className="muted">Avisos de escritorio bloqueados en este navegador</span>;
  }
  return (
    <button type="button" className="btn btn-outline" onClick={async () => setPermission(await Notification.requestPermission())}>
      🔔 Activar avisos de escritorio
    </button>
  );
}

function MessagesAdmin() {
  const { data, error, reload } = useApi("contact");
  const { refreshMessages } = useOutletContext() ?? {};
  const [actionError, setActionError] = useState("");

  async function run(path, options) {
    try {
      await api(path, options);
      reload();
      refreshMessages?.();
    } catch (err) {
      setActionError(err.message);
    }
  }

  const unread = data?.filter((m) => !m.read).length ?? 0;

  return (
    <>
      <div className="panel-header">
        <div>
          <h1>Mensajes</h1>
          <p>Mensajes enviados desde el formulario de contacto del sitio{data ? ` · ${unread} sin leer` : ""}.</p>
        </div>
        <DesktopAlertsButton />
      </div>

      {(error || actionError) && <p className="alert alert-error">{error || actionError}</p>}
      {data?.length === 0 && (
        <div className="card">
          <p>No hay mensajes todavía.</p>
        </div>
      )}

      {data?.map((m) => (
        <article className="card" key={m.id} style={m.read ? { opacity: 0.75 } : { borderColor: "#f0c040" }}>
          <div className="panel-header" style={{ marginBottom: "0.6rem" }}>
            <div>
              <h2 style={{ margin: 0 }}>
                {!m.read && <span className="badge badge-sold">Nuevo</span>} {m.subject || "Sin asunto"}
              </h2>
              <p>
                {m.name} · <a href={`mailto:${m.email}`}>{m.email}</a>
                {m.phone && (
                  <>
                    {" "}
                    · <a href={`tel:${m.phone.replace(/\s/g, "")}`}>{m.phone}</a>
                  </>
                )}{" "}
                · {formatDate(m.created_at)}
              </p>
            </div>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={() => run(`contact?id=${m.id}`, { method: "PUT", body: { read: !m.read } })}
              >
                {m.read ? "Marcar no leído" : "Marcar leído"}
              </button>
              <button
                type="button"
                className="btn btn-danger btn-small"
                onClick={() => confirm("¿Eliminar este mensaje?") && run(`contact?id=${m.id}`, { method: "DELETE" })}
              >
                Eliminar
              </button>
            </div>
          </div>
          <p style={{ whiteSpace: "pre-line", margin: 0 }}>{m.message}</p>
        </article>
      ))}
    </>
  );
}

export default MessagesAdmin;
