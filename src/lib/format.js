const number = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });

export function formatPrice(price, currency = "UF") {
  if (price === null || price === undefined || price === "") return "A convenir";
  if (currency === "CLP") return `$${number.format(price)}`;
  if (currency === "USD") return `US$ ${number.format(price)}`;
  return `UF ${number.format(price)}`;
}

export const formatArea = (m2) => (m2 ? `${number.format(m2)} m²` : null);

export const formatDate = (value) =>
  new Date(value).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });

export function propertyLocation(p) {
  return [p.address, p.commune].filter(Boolean).join(", ");
}

export const STATUS_LABELS = { draft: "Borrador", published: "Publicada", sold: "Vendida / Arrendada" };
export const OPERATIONS = ["Venta", "Arriendo", "Arriendo temporal"];
export const TYPES = [
  "Casa",
  "Departamento",
  "Parcela",
  "Terreno",
  "Oficina",
  "Local comercial",
  "Bodega",
  "Hostal / Comercial",
  "Campo / Agrícola",
];
export const CURRENCIES = ["UF", "CLP", "USD"];

// Las 21 comunas de la región de Ñuble (búsqueda con IA).
export const COMUNAS = [
  "Chillán", "Chillán Viejo", "Bulnes", "Quillón", "San Ignacio", "El Carmen", "Pemuco",
  "Yungay", "Pinto", "Coihueco", "San Carlos", "Ñiquén", "San Fabián", "San Nicolás",
  "Quirihue", "Cobquecura", "Trehuaco", "Coelemu", "Ninhue", "Portezuelo", "Ránquil",
];

export const googleMapsUrl = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;
