import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import "./Navbar.css";

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo" onClick={() => setMenuOpen(false)}>
          <img src="/logo.png" alt="" className="logo-icon" />
          Geoñuble Propiedades
        </Link>
        <button
          className={`hamburger ${menuOpen ? "active" : ""}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuOpen}
          aria-controls="navbar-links"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        <ul id="navbar-links" className={`navbar-links ${menuOpen ? "active" : ""}`}>
          <li>
            <NavLink to="/" onClick={() => setMenuOpen(false)}>
              Inicio
            </NavLink>
          </li>
          <li>
            <NavLink to="/propiedades" onClick={() => setMenuOpen(false)}>
              Propiedades
            </NavLink>
          </li>
          <li>
            <NavLink to="/contacto" onClick={() => setMenuOpen(false)}>
              Contacto
            </NavLink>
          </li>
          <li>
            <Link to="/contacto?asunto=Quiero vender" className="navbar-cta" onClick={() => setMenuOpen(false)}>
              Vende o arrienda
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;
