import { jsPDF } from "jspdf";
import { imageCover, imageToPng } from "./images";
import { staticMap } from "./staticMap";
import { formatArea, formatDate, formatPrice, googleMapsUrl, propertyLocation } from "./format";

// Secciones que el corredor puede incluir o quitar de la cotización.
export const QUOTE_SECTIONS = [
  { id: "photo", label: "Foto principal" },
  { id: "gallery", label: "Galería de fotos (hasta 4)" },
  { id: "address", label: "Dirección" },
  { id: "price", label: "Precio" },
  { id: "specs", label: "Superficie y programa" },
  { id: "description", label: "Descripción" },
  { id: "features", label: "Características" },
  { id: "map", label: "Mapa de ubicación" },
  { id: "broker", label: "Datos del corredor" },
  { id: "validity", label: "Vigencia de la cotización" },
];

const NAVY = [26, 58, 92];
const GOLD = [240, 192, 64];
const GRAY = [95, 107, 120];
const PAGE_W = 210;
const PAGE_H = 297;
const M = 15; // margen
const CONTENT_W = PAGE_W - M * 2;

// La fuente estándar del PDF solo cubre Latin-1: quita emojis y símbolos fuera de rango.
const clean = (s) =>
  String(s ?? "")
    .replace(/[•▪●]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x00-\xFF]/g, "")
    .trim();

const quoteNumber = (id) => String(id).padStart(4, "0");

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function safe(promise) {
  try {
    return await promise;
  } catch {
    return null;
  }
}

/**
 * Genera y descarga el PDF.
 * quote: registro de /api/quotes (id, created_at, client_name, notes, validity_days, broker_*)
 */
export async function downloadQuotePdf({ property, quote, settings, sections }) {
  const has = (id) => sections.includes(id);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 0;

  // Carga de imágenes en paralelo (si alguna falla, se omite).
  const images = property.images || [];
  const hasPoint = property.lat != null && property.lng != null;
  const [logo, cover, gallery, map] = await Promise.all([
    safe(imageToPng("/logo.png", 300)),
    has("photo") && images[0] ? safe(imageCover(images[0].url, CONTENT_W / 95, 1200)) : null,
    has("gallery")
      ? Promise.all(images.slice(has("photo") ? 1 : 0).slice(0, 4).map((img) => safe(imageCover(img.thumb || img.url, 4 / 3, 560))))
      : [],
    has("map") && hasPoint ? safe(staticMap(property.lat, property.lng)) : null,
  ]);

  // --- Encabezado ---
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 30, "F");
  let textX = M;
  if (logo) {
    const h = 18;
    const w = (logo.width / logo.height) * h;
    doc.addImage(logo.data, "PNG", M, 6, w, h);
    textX = M + w + 5;
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(clean(settings.company_name), textX, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Corredores de Propiedades", textX, 20);
  const contactLines = [settings.phone, settings.email, settings.website].map(clean).filter(Boolean);
  contactLines.forEach((line, i) => doc.text(line, PAGE_W - M, 11 + i * 5, { align: "right" }));
  y = 40;

  // --- Número y fecha ---
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`COTIZACIÓN N° ${quoteNumber(quote.id)}`, M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text(`Fecha: ${formatDate(quote.created_at)}`, PAGE_W - M, y, { align: "right" });
  y += 6;
  if (quote.client_name) {
    doc.text(clean(`Preparada para: ${quote.client_name}`), M, y);
    y += 6;
  }
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(M, y, PAGE_W - M, y);
  y += 9;

  // Salto de página cuando no cabe un bloque.
  function ensure(height) {
    if (y + height > PAGE_H - 18) {
      doc.addPage();
      y = M + 5;
    }
  }

  function heading(text) {
    ensure(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text(text, M, y);
    y += 6;
  }

  function paragraph(text, size = 10) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(50, 50, 50);
    const lineH = size * 0.45;
    for (const line of doc.splitTextToSize(clean(text), CONTENT_W)) {
      ensure(lineH);
      doc.text(line, M, y);
      y += lineH;
    }
  }

  // --- Título de la propiedad ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...NAVY);
  for (const line of doc.splitTextToSize(clean(property.title), CONTENT_W)) {
    doc.text(line, M, y);
    y += 7;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  const subtitle = [property.operation, property.type, has("address") ? propertyLocation(property) : ""]
    .map(clean)
    .filter(Boolean)
    .join("  |  ");
  doc.text(doc.splitTextToSize(subtitle, CONTENT_W), M, y);
  y += 4 + doc.splitTextToSize(subtitle, CONTENT_W).length * 4;

  // --- Foto principal ---
  if (cover) {
    const h = 95;
    ensure(h + 4);
    doc.addImage(cover, "JPEG", M, y, CONTENT_W, h);
    y += h + 6;
  }

  // --- Precio ---
  if (has("price")) {
    ensure(20);
    doc.setFillColor(...GOLD);
    doc.roundedRect(M, y, CONTENT_W, 16, 2, 2, "F");
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`PRECIO DE ${clean(property.operation).toUpperCase()}`, M + 5, y + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(clean(formatPrice(property.price, property.currency)), M + 5, y + 13);
    y += 22;
  }

  // --- Superficie y programa ---
  if (has("specs")) {
    const specs = [
      [formatArea(property.total_area), "Sup. total"],
      [formatArea(property.built_area), "Construidos"],
      [property.bedrooms, "Dormitorios"],
      [property.bathrooms, "Baños"],
      [property.parking, "Estacionam."],
    ].filter(([v]) => v !== null && v !== undefined && v !== "");
    if (specs.length) {
      ensure(22);
      const gap = 3;
      const w = (CONTENT_W - gap * (specs.length - 1)) / specs.length;
      specs.forEach(([value, label], i) => {
        const x = M + i * (w + gap);
        doc.setDrawColor(221, 227, 234);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, w, 17, 2, 2, "S");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...NAVY);
        doc.text(clean(String(value)), x + w / 2, y + 7.5, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...GRAY);
        doc.text(label, x + w / 2, y + 13, { align: "center" });
      });
      y += 24;
    }
  }

  // --- Descripción ---
  if (has("description") && property.description) {
    heading("Descripción");
    paragraph(property.description);
    y += 5;
  }

  // --- Características (2 columnas) ---
  if (has("features") && property.features?.length) {
    heading("Características");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    const colW = CONTENT_W / 2 - 4;
    const items = property.features.map((f) => doc.splitTextToSize(clean(f), colW - 5));
    for (let i = 0; i < items.length; i += 2) {
      const rowLines = Math.max(items[i].length, items[i + 1]?.length || 0);
      ensure(rowLines * 4.5 + 1);
      [items[i], items[i + 1]].forEach((lines, col) => {
        if (!lines) return;
        const x = M + col * (CONTENT_W / 2);
        doc.setFillColor(...GOLD);
        doc.circle(x + 1.2, y - 1.2, 1, "F");
        doc.text(lines, x + 4, y);
      });
      y += rowLines * 4.5 + 1;
    }
    y += 4;
  }

  // --- Galería ---
  const photos = (gallery || []).filter(Boolean);
  if (photos.length) {
    heading("Galería");
    const gap = 4;
    const w = (CONTENT_W - gap) / 2;
    const h = w * 0.75;
    for (let i = 0; i < photos.length; i += 2) {
      ensure(h + gap);
      photos.slice(i, i + 2).forEach((img, col) => doc.addImage(img, "JPEG", M + col * (w + gap), y, w, h));
      y += h + gap;
    }
    y += 2;
  }

  // --- Mapa ---
  if (has("map") && hasPoint) {
    heading("Ubicación");
    if (map) {
      const h = CONTENT_W / 2;
      ensure(h + 8);
      doc.addImage(map, "JPEG", M, y, CONTENT_W, h);
      y += h + 5;
    }
    ensure(6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.textWithLink("Ver ubicación en Google Maps", M, y, { url: googleMapsUrl(property.lat, property.lng) });
    y += 8;
  }

  // --- Observaciones ---
  if (quote.notes) {
    heading("Observaciones");
    paragraph(quote.notes);
    y += 5;
  }

  // --- Corredor ---
  if (has("broker") && quote.broker_name) {
    const lines = [quote.broker_position, quote.broker_phone && `Teléfono: ${quote.broker_phone}`, quote.broker_email && `Email: ${quote.broker_email}`]
      .map(clean)
      .filter(Boolean);
    const h = 19 + lines.length * 5;
    ensure(h + 4);
    doc.setFillColor(243, 245, 248);
    doc.roundedRect(M, y, CONTENT_W, h, 2, 2, "F");
    doc.setFillColor(...NAVY);
    doc.rect(M, y, 1.5, h, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text("CORREDOR A CARGO", M + 6, y + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text(clean(quote.broker_name), M + 6, y + 11.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    lines.forEach((line, i) => doc.text(line, M + 6, y + 17 + i * 5));
    y += h + 6;
  }

  // --- Vigencia ---
  if (has("validity")) {
    const until = formatDate(addDays(quote.created_at, quote.validity_days));
    paragraph(`Esta cotización es válida hasta el ${until} (${quote.validity_days} días desde su emisión).`, 9);
    paragraph("Valores y antecedentes referenciales, sujetos a confirmación y disponibilidad de la propiedad.", 9);
  }

  // --- Pie de página en todas las hojas ---
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(221, 227, 234);
    doc.setLineWidth(0.3);
    doc.line(M, PAGE_H - 12, PAGE_W - M, PAGE_H - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    const footer = [settings.company_name, settings.address, settings.website].map(clean).filter(Boolean).join("  |  ");
    doc.text(footer, M, PAGE_H - 7);
    doc.text(`Cotización N° ${quoteNumber(quote.id)}  -  Página ${i} de ${pages}`, PAGE_W - M, PAGE_H - 7, { align: "right" });
  }

  const slug = clean(property.title)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  doc.save(`Cotizacion-${quoteNumber(quote.id)}-${slug}.pdf`);
}
