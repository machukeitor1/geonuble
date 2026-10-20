import { Link, useOutletContext } from "react-router-dom";
import { useAuth } from "../context/contexts";
import { useApi } from "../lib/useApi";
import { formatDate } from "../lib/format";

const isThisMonth = (date) => {
  const d = new Date(date);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

function Stat({ value, label, to }) {
  const content = (
    <>
      <strong>{value ?? "—"}</strong>
      <span>{label}</span>
    </>
  );
  return to ? (
    <Link to={to} className="stat">
      {content}
    </Link>
  ) : (
    <div className="stat">{content}</div>
  );
}

function Shortcut({ to, icon, title, text, badge }) {
  return (
    <Link to={to} className="shortcut">
      <span className="shortcut-icon" aria-hidden="true">
        {icon}
      </span>
      <span>
        <strong>
          {title}
          {badge > 0 && <span className="shortcut-badge">{badge}</span>}
        </strong>
        <small>{text}</small>
      </span>
    </Link>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  const { data: properties } = useApi("properties?all=1");
  const { data: quotes } = useApi("quotes");
  // El contador lo mantiene el panel; al cambiar, se recarga la lista de últimos mensajes.
  const { unreadMessages = 0 } = useOutletContext() ?? {};
  const { data: messages } = useApi(isAdmin ? `contact?v=${unreadMessages}` : null);
  const { data: users } = useApi(isAdmin ? "users" : null);

  const count = (status) => properties?.filter((p) => p.status === status).length;
  const unread = unreadMessages;
  const myQuotes = quotes?.filter((q) => q.user_id === user.id);
  const brokers = users?.filter((u) => u.active).length;
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <div className="panel-header">
        <div>
          <h1>Hola, {firstName}</h1>
          <p>{isAdmin ? "Administrador y corredor" : user.position} · {formatDate(new Date())}</p>
        </div>
        <Link to="/panel/cotizar" className="btn">
          + Nueva cotización
        </Link>
      </div>

      <div className="stats">
        {isAdmin ? (
          <>
            <Stat value={count("published")} label="Propiedades publicadas" to="/panel/propiedades" />
            <Stat value={count("draft")} label="Borradores" to="/panel/propiedades" />
            <Stat value={quotes?.filter((q) => isThisMonth(q.created_at)).length} label="Cotizaciones este mes" to="/panel/cotizaciones" />
            <Stat value={messages ? unread : undefined} label="Mensajes sin leer" to="/panel/mensajes" />
          </>
        ) : (
          <>
            <Stat value={myQuotes?.filter((q) => isThisMonth(q.created_at)).length} label="Mis cotizaciones este mes" to="/panel/cotizaciones" />
            <Stat value={myQuotes?.length} label="Cotizaciones en total" to="/panel/cotizaciones" />
            <Stat value={count("published")} label="Propiedades para cotizar" to="/panel/cotizar" />
          </>
        )}
      </div>

      {/* El administrador ve primero su bloque */}
      {isAdmin && (
        <section className="access-group">
          <h2>Administración</h2>
          <div className="shortcuts">
            <Shortcut to="/panel/propiedades/nueva" icon="➕" title="Cargar propiedad" text="Fotos, precio, ubicación y características" />
            <Shortcut to="/panel/propiedades" icon="🏠" title="Propiedades" text={`${properties?.length ?? 0} en total · editar o publicar`} />
            <Shortcut
              to="/panel/usuarios"
              icon="👥"
              title="Corredores y usuarios"
              text={`${brokers ?? 0} activos · accesos y datos de contacto`}
            />
            <Shortcut to="/panel/mensajes" icon="✉️" title="Mensajes" text="Consultas del formulario de contacto" badge={unread} />
            <Shortcut to="/panel/empresa" icon="🏢" title="Datos de la empresa" text="Teléfono, email y horarios del sitio" />
          </div>
        </section>
      )}

      <section className="access-group">
        <h2>Corredor de propiedades</h2>
        <div className="shortcuts">
          <Shortcut to="/panel/cotizar" icon="📄" title="Nueva cotización" text="Elige una propiedad y descarga el PDF" />
          <Shortcut
            to="/panel/cotizaciones"
            icon="🗂️"
            title={isAdmin ? "Cotizaciones" : "Mis cotizaciones"}
            text="Historial y volver a descargar"
          />
          <Shortcut to="/panel/perfil" icon="👤" title="Mi perfil" text="Tus datos de contacto y contraseña" />
          <Shortcut to="/propiedades" icon="🌐" title="Ver sitio web" text="Las propiedades como las ve el público" />
        </div>
      </section>

      <div className="dashboard-columns">
        <section className="card">
          <div className="card-title">
            <h2>Últimas cotizaciones</h2>
            <Link to="/panel/cotizaciones">Ver todas</Link>
          </div>
          {quotes?.length === 0 && <p className="muted">Aún no hay cotizaciones.</p>}
          <ul className="recent-list">
            {quotes?.slice(0, 5).map((q) => (
              <li key={q.id}>
                <span>
                  <strong>N° {String(q.id).padStart(4, "0")}</strong> · {q.property_title || "Propiedad eliminada"}
                  <small>
                    {q.client_name || "Sin cliente"}
                    {isAdmin && q.broker_name && ` · ${q.broker_name}`}
                  </small>
                </span>
                <time>{formatDate(q.created_at)}</time>
              </li>
            ))}
          </ul>
        </section>

        {isAdmin && (
          <section className="card">
            <div className="card-title">
              <h2>Últimos mensajes</h2>
              <Link to="/panel/mensajes">Ver todos</Link>
            </div>
            {messages?.length === 0 && <p className="muted">No hay mensajes todavía.</p>}
            <ul className="recent-list">
              {messages?.slice(0, 5).map((m) => (
                <li key={m.id}>
                  <span>
                    <strong>
                      {!m.read && <span className="dot" aria-label="Sin leer" />}
                      {m.name}
                    </strong>
                    <small>{m.subject || m.message.slice(0, 60)}</small>
                  </span>
                  <time>{formatDate(m.created_at)}</time>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

export default Dashboard;
