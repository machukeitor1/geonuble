import { Link } from "react-router-dom";
import { usePageTitle } from "../lib/usePageTitle";

function NotFound() {
  usePageTitle("Página no encontrada");
  return (
    <div className="not-found">
      <h1>Página no encontrada</h1>
      <p>La página que buscas no existe o fue movida.</p>
      <Link to="/" className="back-link">
        Volver al Inicio
      </Link>
    </div>
  );
}

export default NotFound;
