import { Link } from "react-router-dom";
import { useSettings } from "../context/contexts";
import "./Footer.css";

function Footer() {
  const settings = useSettings();
  const contact = [
    ["📍", settings.address],
    ["📞", settings.phone],
    ["✉️", settings.email],
  ].filter(([, value]) => value);

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-section">
          <h3>{settings.company_name}</h3>
          <p>
            {settings.about ||
              "Corredores de propiedades con amplia experiencia en la región de Ñuble. Te ayudamos a encontrar la propiedad que buscas."}
          </p>
        </div>
        <div className="footer-section">
          <h3>Enlaces</h3>
          <ul>
            <li><Link to="/">Inicio</Link></li>
            <li><Link to="/propiedades">Propiedades</Link></li>
            <li><Link to="/contacto">Contacto</Link></li>
            <li><Link to="/panel">Acceso administrador y corredores</Link></li>
          </ul>
        </div>
        {contact.length > 0 && (
          <div className="footer-section">
            <h3>Contacto</h3>
            <ul>
              {contact.map(([icon, value]) => (
                <li key={icon}>
                  <span aria-hidden="true">{icon}</span> {value}
                </li>
              ))}
            </ul>
          </div>
        )}
        {settings.hours && (
          <div className="footer-section">
            <h3>Horarios</h3>
            <ul>
              {settings.hours.split("\n").map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} {settings.company_name}. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}

export default Footer;
