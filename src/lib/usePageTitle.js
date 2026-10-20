import { useEffect } from "react";

const SITE = "Geoñuble Propiedades";

// Título de la pestaña del navegador (y de los resultados de búsqueda).
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE}` : `${SITE} | Corredores de Propiedades en Ñuble`;
  }, [title]);
}
