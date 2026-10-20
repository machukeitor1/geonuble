import { Link } from "react-router-dom";
import { formatArea, formatPrice, propertyLocation } from "../lib/format";
import "./PropertyCard.css";

function PropertyCard({ property }) {
  const cover = property.images[0];
  const location = propertyLocation(property);
  const details = [
    property.bedrooms != null && `${property.bedrooms} dorm.`,
    property.bathrooms != null && `${property.bathrooms} baño(s)`,
    formatArea(property.total_area || property.built_area),
  ].filter(Boolean);

  return (
    <article className="property-card">
      <div className="property-card-image">
        {cover ? (
          <img src={cover.thumb || cover.url} alt="" loading="lazy" />
        ) : (
          <div className="property-card-noimg">Sin fotos</div>
        )}
        <span className="property-card-badge">{property.operation}</span>
        <span className="property-card-type">{property.type}</span>
      </div>
      <div className="property-card-body">
        <h3 className="property-card-title">{property.title}</h3>
        {location && <p className="property-card-location">{location}</p>}
        <p className="property-card-price">{formatPrice(property.price, property.currency)}</p>
        {details.length > 0 && (
          <div className="property-card-details">
            {details.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
        )}
        <Link to={`/propiedades/${property.id}`} className="property-card-link">
          Ver Detalle<span className="sr-only"> de {property.title}</span>
        </Link>
      </div>
    </article>
  );
}

export default PropertyCard;
