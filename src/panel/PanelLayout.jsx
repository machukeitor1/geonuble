import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/contexts";

function PanelLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

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
          </button>
        </div>

        <nav className="panel-nav" id="panel-nav" onClick={close}>
          <NavLink to="/panel" end>
            Inicio
          </NavLink>
          <span className="panel-nav-title">Corredor</span>
          <NavLink to="/panel/cotizar">Nueva cotización</NavLink>
          <NavLink to="/panel/cotizaciones">{user.role === "admin" ? "Cotizaciones" : "Mis cotizaciones"}</NavLink>
          {user.role === "admin" && (
            <>
              <span className="panel-nav-title">Administración</span>
              <NavLink to="/panel/propiedades">Propiedades</NavLink>
              <NavLink to="/panel/usuarios">Corredores y usuarios</NavLink>
              <NavLink to="/panel/mensajes">Mensajes</NavLink>
              <NavLink to="/panel/empresa">Datos de la empresa</NavLink>
            </>
          )}
          <span className="panel-nav-title">Cuenta</span>
          <NavLink to="/panel/perfil">Mi perfil</NavLink>
          <Link to="/">Ver sitio web</Link>
        </nav>

        <div className="panel-user">
          <strong>{user.name}</strong>
          <span>{user.role === "admin" ? "Administrador" : user.position}</span>
          <br />
          <button type="button" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="panel-main">
        <Outlet />
      </main>
    </div>
  );
}

export default PanelLayout;
