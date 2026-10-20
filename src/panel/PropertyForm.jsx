import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import MapView from "../components/MapView";
import { api } from "../lib/api";
import { uploadPropertyImage } from "../lib/images";
import { CURRENCIES, OPERATIONS, STATUS_LABELS, TYPES } from "../lib/format";
import { LEAVE_MESSAGE, unsavedGuard } from "./unsavedGuard";

const EMPTY = {
  title: "",
  description: "",
  operation: "Venta",
  type: "Casa",
  price: "",
  currency: "UF",
  address: "",
  commune: "Chillán",
  lat: null,
  lng: null,
  total_area: "",
  built_area: "",
  bedrooms: "",
  bathrooms: "",
  parking: "",
  features: [],
  images: [],
  status: "draft",
  featured: false,
};

// Extrae latitud y longitud de un enlace de Google Maps ("?q=lat,lng", "@lat,lng", "!3dlat!4dlng")
// o de coordenadas escritas ("-36.62, -72.06"). Devuelve null si no encuentra un punto válido.
function parseCoordinates(value) {
  let textValue = String(value || "");
  try {
    textValue = decodeURIComponent(textValue);
  } catch {
    // Texto con "%" sueltos: se usa tal cual.
  }
  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /(-?\d{1,2}\.\d+)\s*,[\s+]*(-?\d{1,3}\.\d+)/,
  ];
  for (const pattern of patterns) {
    const match = textValue.match(pattern);
    if (match) {
      const lat = Number(match[1]);
      const lng = Number(match[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}

// Convierte null a "" para los inputs controlados.
const toForm = (p) =>
  Object.fromEntries(Object.entries({ ...EMPTY, ...p }).map(([k, v]) => [k, v === null && !["lat", "lng"].includes(k) ? "" : v]));

function PropertyForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [featuresText, setFeaturesText] = useState("");
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [searching, setSearching] = useState(false);
  const [uploadError, setUploadError] = useState("");
  // Último estado guardado; si el formulario difiere, hay cambios sin guardar.
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify({ form: EMPTY, featuresText: "" }));
  // Fotos subidas en esta sesión que aún no se guardan (para limpiarlas si se cancela).
  const pendingUploads = useRef([]);

  useEffect(() => {
    if (!id) return;
    api(`properties?id=${id}`)
      .then((p) => {
        const loaded = { form: toForm(p), featuresText: p.features.join("\n") };
        setForm(loaded.form);
        setFeaturesText(loaded.featuresText);
        setSavedSnapshot(JSON.stringify(loaded));
      })
      .catch((err) => setMessage({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  async function handleFiles(e) {
    const files = [...e.target.files];
    e.target.value = "";
    setUploadError("");
    setUploading((n) => n + files.length);
    for (const file of files) {
      try {
        const image = await uploadPropertyImage(file);
        pendingUploads.current.push(image);
        setForm((f) => ({ ...f, images: [...f.images, image] }));
      } catch (err) {
        setUploadError(`No se pudo subir "${file.name}": ${err.message}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  function moveImage(index, delta) {
    setForm((f) => {
      const images = [...f.images];
      const [img] = images.splice(index, 1);
      images.splice(index + delta, 0, img);
      return { ...f, images };
    });
  }

  function removeImage(index) {
    const img = form.images[index];
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== index) }));
    // Si la foto aún no estaba guardada, se borra ya del almacenamiento.
    if (pendingUploads.current.includes(img)) {
      pendingUploads.current = pendingUploads.current.filter((p) => p !== img);
      for (const key of [img.key, img.thumbKey]) {
        api(`upload?key=${encodeURIComponent(key)}`, { method: "DELETE" }).catch(() => {});
      }
    }
  }

  async function findAddress() {
    const q = [form.address, form.commune, "Chile"].filter(Boolean).join(", ");
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
      const [result] = await res.json();
      if (!result) throw new Error("No se encontró la dirección. Marca el punto directamente en el mapa.");
      setForm((f) => ({ ...f, lat: Number(result.lat), lng: Number(result.lon) }));
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSearching(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });
    const body = { ...form, features: featuresText.split("\n") };
    try {
      const saved = await api(id ? `properties?id=${id}` : "properties", { method: id ? "PUT" : "POST", body });
      pendingUploads.current = [];
      const after = { form: toForm(saved), featuresText: saved.features.join("\n") };
      setForm(after.form);
      setFeaturesText(after.featuresText);
      setSavedSnapshot(JSON.stringify(after));
      if (!id) navigate(`/panel/propiedades/${saved.id}`, { replace: true });
      setMessage({ type: "ok", text: "Propiedad guardada." });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  const dirty = JSON.stringify({ form, featuresText }) !== savedSnapshot;

  // Aviso del navegador al cerrar o recargar la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // El menú lateral consulta esta marca antes de navegar.
  useEffect(() => {
    unsavedGuard.dirty = dirty;
    return () => {
      unsavedGuard.dirty = false;
    };
  }, [dirty]);

  const confirmLeave = (e) => {
    if (dirty && !confirm(LEAVE_MESSAGE)) e.preventDefault();
  };

  // Al salir sin guardar, borra las fotos que se subieron.
  useEffect(() => {
    const pending = pendingUploads;
    return () => {
      for (const img of pending.current) {
        for (const key of [img.key, img.thumbKey]) {
          api(`upload?key=${encodeURIComponent(key)}`, { method: "DELETE" }).catch(() => {});
        }
      }
    };
  }, []);

  if (loading) return <p className="muted">Cargando…</p>;

  return (
    <form onSubmit={handleSubmit}>
      <div className="panel-header">
        <div>
          <h1>{id ? "Editar propiedad" : "Nueva propiedad"}</h1>
          {id && <p>Código #{id}</p>}
        </div>
        <div className="btn-row">
          <Link to="/panel/propiedades" className="btn btn-outline" onClick={confirmLeave}>
            Volver
          </Link>
          {id && form.status === "published" && (
            <Link to={`/propiedades/${id}`} className="btn btn-outline" target="_blank">
              Ver en el sitio
            </Link>
          )}
          <button className="btn" disabled={saving || uploading > 0}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      {message.text && (
        <p className={`alert alert-${message.type === "ok" ? "ok" : "error"}`} role="status">
          {message.text}
        </p>
      )}

      <section className="card">
        <h2>Datos principales</h2>
        <div className="form-grid">
          <label className="field field-wide">
            Título *
            <input value={form.title} onChange={set("title")} required maxLength={200} placeholder="Ej: Casa en Barrio El Rodeo" />
          </label>
          <label className="field">
            Operación
            <select value={form.operation} onChange={set("operation")}>
              {OPERATIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Tipo
            <select value={form.type} onChange={set("type")}>
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Precio
            <input type="number" min="0" step="any" value={form.price} onChange={set("price")} />
            <small>Vacío = “A convenir”</small>
          </label>
          <label className="field">
            Moneda
            <select value={form.currency} onChange={set("currency")}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Estado
            <select value={form.status} onChange={set("status")}>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="check" style={{ alignSelf: "end", paddingBottom: "0.6rem" }}>
            <input type="checkbox" checked={form.featured} onChange={set("featured")} />
            Destacada en el inicio
          </label>
          <label className="field field-wide">
            Descripción
            <textarea rows={6} value={form.description} onChange={set("description")} />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Superficie y programa</h2>
        <div className="form-grid">
          <label className="field">
            Superficie total (m²)
            <input type="number" min="0" step="any" value={form.total_area} onChange={set("total_area")} />
          </label>
          <label className="field">
            Construidos (m²)
            <input type="number" min="0" step="any" value={form.built_area} onChange={set("built_area")} />
          </label>
          <label className="field">
            Dormitorios
            <input type="number" min="0" value={form.bedrooms} onChange={set("bedrooms")} />
          </label>
          <label className="field">
            Baños
            <input type="number" min="0" value={form.bathrooms} onChange={set("bathrooms")} />
          </label>
          <label className="field">
            Estacionamientos
            <input type="number" min="0" value={form.parking} onChange={set("parking")} />
          </label>
          <label className="field field-wide">
            Características
            <textarea
              rows={6}
              value={featuresText}
              onChange={(e) => setFeaturesText(e.target.value)}
              placeholder={"Una por línea, por ejemplo:\nPiscina\nCocina amoblada\nVentanas termopanel"}
            />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Fotos</h2>
        <p className="muted">
          Se optimizan automáticamente antes de subir. La primera foto es la portada; usa las flechas para ordenar.
        </p>
        {form.images.length > 0 && (
          <div className="photo-grid">
            {form.images.map((img, i) => (
              <div className="photo-item" key={img.key || img.url}>
                <img src={img.thumb || img.url} alt={`Foto ${i + 1}`} />
                {i === 0 && <span className="photo-cover">Portada</span>}
                <div className="photo-actions">
                  <button type="button" onClick={() => moveImage(i, -1)} disabled={i === 0} aria-label={`Mover foto ${i + 1} a la izquierda`}>
                    ←
                  </button>
                  <button type="button" onClick={() => removeImage(i)} aria-label={`Quitar foto ${i + 1}`}>
                    🗑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(i, 1)}
                    disabled={i === form.images.length - 1}
                    aria-label={`Mover foto ${i + 1} a la derecha`}
                  >
                    →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <label className="upload-zone">
          {uploading > 0 ? `Subiendo ${uploading} foto(s)…` : "＋ Agregar fotos (puedes elegir varias)"}
          <input type="file" accept="image/*" multiple onChange={handleFiles} className="sr-only" />
        </label>
        {uploadError && (
          <p className="alert alert-error" role="alert" style={{ marginTop: "0.8rem", marginBottom: 0 }}>
            {uploadError}
          </p>
        )}
      </section>

      <section className="card">
        <h2>Ubicación</h2>
        <div className="form-grid" style={{ marginBottom: "1rem" }}>
          <label className="field">
            Dirección
            <input value={form.address} onChange={set("address")} placeholder="Calle y número" />
          </label>
          <label className="field">
            Comuna
            <input value={form.commune} onChange={set("commune")} />
          </label>
          <div className="btn-row" style={{ alignItems: "end" }}>
            <button type="button" className="btn btn-outline" onClick={findAddress} disabled={searching || !form.address}>
              {searching ? "Buscando…" : "Buscar en el mapa"}
            </button>
            {form.lat != null && (
              <button type="button" className="btn btn-danger" onClick={() => setForm((f) => ({ ...f, lat: null, lng: null }))}>
                Quitar punto
              </button>
            )}
          </div>
        </div>
        <label className="field" style={{ marginBottom: "1rem" }}>
          Enlace de Google Maps o coordenadas
          <input
            placeholder="Pega aquí el enlace de Google Maps o algo como -36.62097, -72.06055"
            onChange={(e) => {
              const point = parseCoordinates(e.target.value);
              if (point) {
                setForm((f) => ({ ...f, ...point }));
                setMessage({ type: "ok", text: "Ubicación marcada desde el enlace." });
              }
            }}
          />
          <small>
            {form.lat != null
              ? `Punto actual: ${form.lat.toFixed(6)}, ${form.lng.toFixed(6)}`
              : "En Google Maps: clic derecho sobre el punto y copia las coordenadas (los enlaces cortos maps.app.goo.gl no traen el punto)."}
          </small>
        </label>
        <p className="muted">También puedes hacer clic en el mapa para marcar o corregir la ubicación.</p>
        <MapView lat={form.lat} lng={form.lng} onPick={(lat, lng) => setForm((f) => ({ ...f, lat, lng }))} />
      </section>

      <div className="btn-row">
        <button className="btn" disabled={saving || uploading > 0}>
          {saving ? "Guardando…" : "Guardar propiedad"}
        </button>
      </div>

      {/* Barra fija mientras haya cambios sin guardar (p. ej. fotos recién subidas) */}
      {(dirty || uploading > 0) && (
        <div className="unsaved-bar" role="status">
          <span>
            {uploading > 0
              ? `Subiendo ${uploading} foto(s)… espera para guardar.`
              : "Tienes cambios sin guardar. Las fotos nuevas se publican al guardar."}
          </span>
          <button className="btn" disabled={saving || uploading > 0}>
            {saving ? "Guardando…" : "Guardar ahora"}
          </button>
        </div>
      )}
    </form>
  );
}

export default PropertyForm;
