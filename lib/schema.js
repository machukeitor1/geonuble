// Esquema de la base de datos. Se aplica con `npm run db:setup` (Neon)
// o automáticamente en desarrollo local (PGlite).
export const schema = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'broker' CHECK (role IN ('admin', 'broker')),
  phone TEXT NOT NULL DEFAULT '',
  position TEXT NOT NULL DEFAULT 'Corredor de Propiedades',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS properties (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  operation TEXT NOT NULL DEFAULT 'Venta',
  type TEXT NOT NULL DEFAULT 'Casa',
  price DOUBLE PRECISION,
  currency TEXT NOT NULL DEFAULT 'UF',
  address TEXT NOT NULL DEFAULT '',
  commune TEXT NOT NULL DEFAULT '',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  total_area DOUBLE PRECISION,
  built_area DOUBLE PRECISION,
  bedrooms INT,
  bathrooms INT,
  parking INT,
  features JSONB NOT NULL DEFAULT '[]',
  images JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'sold')),
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quotes (
  id SERIAL PRIMARY KEY,
  property_id INT REFERENCES properties(id) ON DELETE SET NULL,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  sections JSONB NOT NULL DEFAULT '[]',
  validity_days INT NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
`;

// Columnas públicas de una propiedad (sin el embedding, que pesa ~1024 números).
export const PROPERTY_FIELDS = `id, title, description, operation, type, price, currency, address, commune,
  lat, lng, total_area, built_area, bedrooms, bathrooms, parking, features, images, status, featured,
  created_at, updated_at`;

// Búsqueda con IA: pgvector, embedding de cada propiedad y hash del texto embebido
// (si el texto no cambia, el embedding no se recalcula). La dimensión depende del
// modelo (bge-m3 = 1024); cambiarla exige borrar la columna y volver a generar.
export const embeddingDim = () => {
  const dim = Number(process.env.EMBEDDINGS_DIM || 1024);
  if (!Number.isInteger(dim) || dim <= 0 || dim > 4000) throw new Error("EMBEDDINGS_DIM inválido");
  return dim;
};

export const vectorSchema = (dim = embeddingDim()) => `
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS embedding vector(${dim});
ALTER TABLE properties ADD COLUMN IF NOT EXISTS embedding_hash TEXT;
CREATE INDEX IF NOT EXISTS properties_embedding_idx ON properties USING hnsw (embedding vector_cosine_ops);
`;
