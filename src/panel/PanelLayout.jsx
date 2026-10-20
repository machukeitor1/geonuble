import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/contexts";
import { useMessageAlerts } from "./useMessageAlerts";
import { LEAVE_MESSAGE, unsavedGuard } from "./unsavedGuard";

function CountBadge({ count, label }) {
  if (!count) return null;
  return (
    <span className="nav-badge" aria-label={`${count} ${label}`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

function PanelLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const isAdmin = user.role === "admin";
  const messages = useMessageAlerts(isAdmin);
  // El aviso emergente no se muestra si ya estás viendo los mensajes.
  const showAlert = messages.alert && pathname !== "/panel/mensajes";

  async function handleLogout() {
    await logout();
    navigate("/panel");
  }

  return (
    <div className="panel">
      <aside className={`panel-sidebar ${open ? "open" : ""}`}>
        <div className="panel-top">
          <Link to="/" className="panel-brand">
            <img src="/logo.png" alt="" />
            Geoñuble
          </Link>
          <button
            type="button"
            className="panel-menu-btn"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="panel-nav"
          >
            Menú
            <CountBadge count={messages.unread} label="mensajes sin leer" />
          </button>
        </div>

        <nav
          className="panel-nav"
          id="panel-nav"
          // En fase de captura: se decide antes de que el enlace navegue.
          onClickCapture={(e) => {
            if (e.target.closest("a") && unsavedGuard.dirty && !confirm(LEAVE_MESSAGE)) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onClick={close}
        >
          <NavLink to="/panel" end>
            Inicio
          </NavLink>
          <span className="panel-nav-title">Corredor</span>
          <NavLink to="/panel/cotizar">Nueva cotización</NavLink>
          <NavLink to="/panel/cotizaciones">{isAdmin ? "Cotizaciones" : "Mis cotizaciones"}</NavLink>
          {isAdmin && (
            <>
              <span className="panel-nav-title">Administración</span>
              <NavLink to="/panel/propiedades">Propiedades</NavLink>
              <NavLink to="/panel/usuarios">Corredores y usuarios</NavLink>
              <NavLink to="/panel/mensajes">
                Mensajes
                <CountBadge count={messages.unread} label="sin leer" />
              </NavLink>
              <NavLink to="/panel/empresa">Datos de la empresa</NavLink>
            </>
          )}
          <span className="panel-nav-title">Cuenta</span>
          <NavLink to="/panel/perfil">Mi perfil</NavLink>
          <Link to="/">Ver sitio web</Link>
        </nav>

        <div className="panel-user">
          <strong>{user.name}</strong>
          <span>{isAdmin ? "Administrador" : user.position}</span>
          <br />
          <button type="button" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="panel-main">
        <Outlet context={{ refreshMessages: messages.refresh, unreadMessages: messages.unread }} />
      </main>

      {showAlert && (
        <div className="toast" role="status" aria-live="polite">
          <span className="toast-icon" aria-hidden="true">
            ✉️
          </span>
          <div>
            <strong>Nuevo mensaje de {messages.alert.name}</strong>
            {messages.alert.subject && <small>{messages.alert.subject}</small>}
            <Link to="/panel/mensajes" onClick={messages.dismiss}>
              Ver mensajes →
            </Link>
          </div>
          <button type="button" className="toast-close" onClick={messages.dismiss} aria-label="Cerrar aviso">
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default PanelLayout;
