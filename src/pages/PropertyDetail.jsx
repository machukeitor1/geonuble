import { lazy, Suspense } from "react";
import { useParams, Link } from "react-router-dom";
import Slideshow from "../components/Slideshow";
import { useApi } from "../lib/useApi";
import { usePageTitle } from "../lib/usePageTitle";
import { formatArea, formatPrice, googleMapsUrl, propertyLocation } from "../lib/format";
import "./PropertyDetail.css";

// El mapa (Leaflet) se carga solo cuando la propiedad tiene ubicación.
const MapView = lazy(() => import("../components/MapView"));

function PropertyDetail() {
  const { id } = useParams();
  const { data: property, error, loading } = useApi(`properties?id=${encodeURIComponent(id)}`);
  usePageTitle(property?.title || "Propiedad");

  if (loading) return <p className="status-message">Cargando propiedad…</p>;
  if (error || !property) {
    return (
      <div className="not-found">
        <h1>Propiedad no encontrada</h1>
        <p>{error && error !== "Propiedad no encontrada" ? error : "La propiedad que buscas no existe o ya no está disponible."}</p>
        <Link to="/propiedades" className="back-link">
          Volver a Propiedades
        </Link>
      </div>
    );
  }

  const images = property.images;
  const location = propertyLocation(property);
  const hasMap = property.lat != null && property.lng != null;
  const metrics = [
    [property.bedrooms, "Dormitorios"],
    [property.bathrooms, "Baños"],
    [property.parking, "Estacionamientos"],
    [formatArea(property.total_area), "Superficie total"],
    [formatArea(property.built_area), "Construidos"],
  ].filter(([value]) => value !== null && value !== undefined);

  return (
    <div className="detail-page">
      <div className="container">
        <Link to="/propiedades" className="back-link">
          ← Volver a Propiedades
        </Link>

        <div className="detail-grid">
          <div className="detail-gallery">
            {/* key: al cambiar de propiedad la presentación parte desde la primera foto */}
            <Slideshow key={property.id} images={images} title={property.title} />
          </div>

          <div className="detail-info">
            <div className="detail-tags">
              <span className="tag tag-operation">{property.operation}</span>
              <span className="tag tag-type">{property.type}</span>
            </div>
            <h1>{property.title}</h1>
            {location && <p className="detail-location">{location}</p>}
            <p className="detail-price">{formatPrice(property.price, property.currency)}</p>

            {metrics.length > 0 && (
              <div className="detail-metrics">
                <div className="detail-metrics-row">
                  {metrics.map(([value, label]) => (
                    <div className="metric" key={label}>
                      <strong>{value}</strong>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {property.description && (
              <>
                <h2>Descripción</h2>
                <p className="detail-description">{property.description}</p>
              </>
            )}

            {property.features.length > 0 && (
              <>
                <h2>Características</h2>
                <ul className="detail-features">
                  {property.features.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </>
            )}

            <div className="detail-contact">
              <h3>¿Te interesa esta propiedad?</h3>
              <Link to={`/contacto?propiedad=${property.id}`} className="contact-btn">
                Contáctanos
              </Link>
            </div>
          </div>
        </div>

        {hasMap && (
          <div className="detail-map">
            <h2>Ubicación</h2>
            <Suspense fallback={<div style={{ height: 350 }} />}>
              <MapView lat={property.lat} lng={property.lng} height={350} />
            </Suspense>
            <a href={googleMapsUrl(property.lat, property.lng)} target="_blank" rel="noreferrer">
              Abrir en Google Maps
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default PropertyDetail;
