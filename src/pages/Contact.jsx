import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSettings } from "../context/contexts";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import { usePageTitle } from "../lib/usePageTitle";
import "./Contact.css";

function ContactInfo({ icon, label, children }) {
  return (
    <div className="contact-item">
      <span className="contact-icon" aria-hidden="true">{icon}</span>
      <div>
        <strong>{label}</strong>
        {children}
      </div>
    </div>
  );
}

function Contact() {
  const settings = useSettings();
  const [params] = useSearchParams();
  usePageTitle("Contacto");
  const propertyId = params.get("propiedad");
  const subject = propertyId ? "Consulta por propiedad" : params.get("asunto") || "";
  const { data: property } = useApi(propertyId ? `properties?id=${encodeURIComponent(propertyId)}` : null);
  const [status, setStatus] = useState({ state: "idle", error: "" });

  async function handleSubmit(e) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget));
    setStatus({ state: "sending", error: "" });
    try {
      await api("contact", { method: "POST", body: form });
      setStatus({ state: "sent", error: "" });
    } catch (err) {
      setStatus({ state: "idle", error: err.message });
    }
  }

  const whatsapp = settings.whatsapp?.replace(/\D/g, "");

  return (
    <div className="contact-page">
      <div className="page-header">
        <div className="container">
          <h1>Contacto</h1>
          <p>Estamos para ayudarte. Cuéntanos qué estás buscando.</p>
        </div>
      </div>
      <div className="container">
        <div className="contact-grid">
          <div className="contact-info">
            <h2>Información de Contacto</h2>
            {settings.address && (
              <ContactInfo icon="📍" label="Dirección">
                <p>{settings.address}</p>
              </ContactInfo>
            )}
            {settings.phone && (
              <ContactInfo icon="📞" label="Teléfono">
                <p>
                  <a href={`tel:${settings.phone.replace(/\s/g, "")}`}>{settings.phone}</a>
                </p>
              </ContactInfo>
            )}
            {whatsapp && (
              <ContactInfo icon="💬" label="WhatsApp">
                <p>
                  <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">
                    {settings.whatsapp}
                  </a>
                </p>
              </ContactInfo>
            )}
            {settings.email && (
              <ContactInfo icon="✉️" label="Email">
                <p>
                  <a href={`mailto:${settings.email}`}>{settings.email}</a>
                </p>
              </ContactInfo>
            )}
            {settings.hours && (
              <ContactInfo icon="🕐" label="Horarios">
                {settings.hours.split("\n").map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </ContactInfo>
            )}
          </div>

          {status.state === "sent" ? (
            <div className="contact-form sent" role="status">
              <h2>¡Mensaje enviado!</h2>
              <p>Gracias por escribirnos. Te responderemos a la brevedad.</p>
            </div>
          ) : (
            <form className="contact-form" onSubmit={handleSubmit}>
              <h2>Envíanos un Mensaje</h2>
              <div className="form-group">
                <label htmlFor="name">Nombre</label>
                <input type="text" name="name" id="name" placeholder="Tu nombre" autoComplete="name" required />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input type="email" name="email" id="email" placeholder="tu@email.com" autoComplete="email" required />
              </div>
              <div className="form-group">
                <label htmlFor="phone">Teléfono</label>
                <input type="tel" name="phone" id="phone" placeholder="+56 9 1234 5678" autoComplete="tel" />
              </div>
              <div className="form-group">
                <label htmlFor="subject">Asunto</label>
                <select name="subject" id="subject" defaultValue={subject}>
                  <option value="">Selecciona un asunto</option>
                  <option>Consulta por propiedad</option>
                  <option>Quiero comprar</option>
                  <option>Quiero vender</option>
                  <option>Quiero arrendar</option>
                  <option>Consulta general</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="message">Mensaje</label>
                <textarea
                  key={property?.id ?? "empty"}
                  name="message"
                  id="message"
                  rows="5"
                  placeholder="Cuéntanos qué estás buscando..."
                  defaultValue={property ? `Hola, me interesa la propiedad "${property.title}" (código ${property.id}).` : ""}
                  required
                />
              </div>
              {/* Campo trampa para bots */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" className="sr-only" aria-hidden="true" />
              {status.error && (
                <p className="form-error" role="alert">
                  {status.error}
                </p>
              )}
              <button type="submit" className="submit-btn" disabled={status.state === "sending"}>
                {status.state === "sending" ? "Enviando…" : "Enviar Mensaje"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default Contact;
