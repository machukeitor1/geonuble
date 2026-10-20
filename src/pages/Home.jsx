import { Link, useNavigate } from "react-router-dom";
import PropertyCard from "../components/PropertyCard";
import { useSettings } from "../context/contexts";
import { useApi } from "../lib/useApi";
import { usePageTitle } from "../lib/usePageTitle";
import { OPERATIONS, TYPES } from "../lib/format";
import "./Home.css";

const SERVICES = [
  {
    icon: "🔑",
    title: "Comprar",
    text: "Te mostramos opciones que calzan con lo que buscas y te acompañamos hasta la firma.",
    link: "/propiedades?operacion=Venta",
    cta: "Ver propiedades en venta",
  },
  {
    icon: "🏷️",
    title: "Vender",
    text: "Tasamos, fotografiamos y publicamos tu propiedad, y gestionamos las visitas por ti.",
    link: "/contacto?asunto=Quiero vender",
    cta: "Quiero vender",
  },
  {
    icon: "📝",
    title: "Arrendar",
    text: "Buscamos arrendatarios confiables o el lugar ideal para vivir o instalar tu negocio.",
    link: "/propiedades?operacion=Arriendo",
    cta: "Ver arriendos",
  },
];

const REASONS = [
  ["📍", "Conocimiento local", "Conocemos cada sector de Chillán y la región de Ñuble."],
  ["🤝", "Atención personalizada", "Un corredor a cargo que te acompaña en cada paso."],
  ["📋", "Asesoría completa", "Desde la búsqueda y la tasación hasta la escrituración."],
  ["🔒", "Transparencia", "Información clara, por escrito y sin sorpresas."],
];

function HeroSearch({ properties }) {
  const navigate = useNavigate();
  // Muestra las opciones con propiedades publicadas; si aún no hay, las estándar.
  const operations = properties?.length ? [...new Set(properties.map((p) => p.operation))] : OPERATIONS;
  const types = properties?.length ? [...new Set(properties.map((p) => p.type))] : TYPES;

  function handleSubmit(e) {
    e.preventDefault();
    const params = new URLSearchParams();
    const { operacion, tipo } = Object.fromEntries(new FormData(e.currentTarget));
    if (operacion) params.set("operacion", operacion);
    if (tipo) params.set("tipo", tipo);
    navigate(`/propiedades${params.size ? `?${params}` : ""}`);
  }

  return (
    <form className="hero-search" onSubmit={handleSubmit} role="search">
      <label>
        <span>Quiero</span>
        <select name="operacion" defaultValue="">
          <option value="">Comprar o arrendar</option>
          {operations.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Tipo de propiedad</span>
        <select name="tipo" defaultValue="">
          <option value="">Todas</option>
          {types.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <button type="submit">Buscar</button>
    </form>
  );
}

function Home() {
  usePageTitle(null);
  const settings = useSettings();
  const { data: properties, loading } = useApi("properties");
  // La API ordena primero las destacadas.
  const featured = (properties || []).slice(0, 6);
  const whatsapp = settings.whatsapp?.replace(/\D/g, "");

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-content container">
          {/* El texto va a la derecha para dejar a la vista la Catedral del banner */}
          <div className="hero-panel">
            <p className="hero-eyebrow">Corredores de propiedades en Chillán y Ñuble</p>
            <h1>Encuentra la propiedad ideal en Ñuble</h1>
            <p className="hero-lead">
              Te ayudamos a comprar, vender o arrendar con asesoría cercana y conocimiento real de la zona.
            </p>
            <HeroSearch properties={properties} />
            <p className="hero-secondary">
              ¿Tienes una propiedad? <Link to="/contacto?asunto=Quiero vender">Véndela o arriéndala con nosotros →</Link>
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="section-eyebrow">Catálogo</p>
              <h2>Propiedades destacadas</h2>
            </div>
            {featured.length > 0 && (
              <Link to="/propiedades" className="link-arrow">
                Ver todas{properties.length > featured.length ? ` (${properties.length})` : ""} →
              </Link>
            )}
          </div>

          {loading && <p className="status-message">Cargando propiedades…</p>}
          {featured.length > 0 ? (
            <div className="featured-grid">
              {featured.map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
          ) : (
            !loading && (
              <div className="home-empty">
                <h3>Estamos preparando nuevas propiedades</h3>
                <p>Cuéntanos qué buscas y te avisamos apenas tengamos algo para ti.</p>
                <Link to="/contacto" className="btn-primary">
                  Contáctanos
                </Link>
              </div>
            )
          )}
        </div>
      </section>

      <section className="section section-soft">
        <div className="container">
          <div className="section-head section-head-center">
            <div>
              <p className="section-eyebrow">Servicios</p>
              <h2>¿Qué necesitas?</h2>
            </div>
          </div>
          <div className="services-grid">
            {SERVICES.map((s) => (
              <article className="service-card" key={s.title}>
                <span className="service-icon" aria-hidden="true">
                  {s.icon}
                </span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
                <Link to={s.link} className="link-arrow">
                  {s.cta} →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-blue">
        <div className="container">
          <div className="section-head section-head-center">
            <div>
              <p className="section-eyebrow">Geoñuble</p>
              <h2>¿Por qué elegirnos?</h2>
            </div>
          </div>
          <div className="features-grid">
            {REASONS.map(([icon, title, text]) => (
              <div className="feature-item" key={title}>
                <div className="feature-icon" aria-hidden="true">
                  {icon}
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="cta-band">
            <div>
              <h2>¿Quieres vender o arrendar tu propiedad?</h2>
              <p>Te asesoramos sin compromiso: tasación, publicación y gestión de visitas.</p>
            </div>
            <div className="cta-actions">
              <Link to="/contacto?asunto=Quiero vender" className="btn-primary">
                Escríbenos
              </Link>
              {whatsapp && (
                <a href={`https://wa.me/${whatsapp}`} className="btn-light" target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              )}
              {!whatsapp && settings.phone && (
                <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="btn-light">
                  Llamar {settings.phone}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
