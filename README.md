# Geoñuble Propiedades

Sitio web y panel de gestión de Geoñuble Propiedades, corredora en la región de Ñuble (Chillán, Chile).

| Módulo | Ruta | Quién |
|---|---|---|
| Sitio público | `/`, `/propiedades`, `/contacto` | Visitantes |
| Administrador | `/panel/propiedades`, `/panel/usuarios`, `/panel/mensajes`, `/panel/empresa` | Rol **admin** |
| Corredor | `/panel/cotizar`, `/panel/cotizaciones`, `/panel/perfil` | Rol **admin** y **corredor** |

- **Admin** carga propiedades (fotos, ubicación en mapa, características), crea los usuarios de los corredores con sus datos de contacto, revisa los mensajes del formulario y edita los datos de la empresa (teléfono, email, horarios…).
- **Corredor** elige una propiedad, marca qué secciones lleva (foto, galería, precio, superficie, descripción, características, mapa, datos del corredor, vigencia) y descarga una **cotización en PDF** numerada.

## Tecnología

- React 19 + React Router 7 + Vite (frontend)
- Funciones serverless de **Vercel** en `api/` (backend)
- **Neon** (PostgreSQL) para datos
- **Cloudflare R2** para las fotos (se optimizan en el navegador antes de subir: máx. 1400 px y miniatura de 560 px)
- Leaflet + OpenStreetMap (mapas) y jsPDF (cotizaciones)

## Desarrollo local

No necesitas cuentas para probar en tu computador: sin `DATABASE_URL` se usa una base local (PGlite en `.data/`) y sin `R2_*` las fotos se guardan en `public/uploads/`.

```bash
npm install
cp .env.example .env.local   # completa ADMIN_EMAIL y ADMIN_PASSWORD
npm run dev
```

Abre http://localhost:5173/panel e ingresa con `ADMIN_EMAIL` / `ADMIN_PASSWORD` (el administrador se crea solo la primera vez).

Para empezar de cero en local, borra las carpetas `.data/` y `public/uploads/`.

## Puesta en producción

### 1. Neon (base de datos)

1. Crea un proyecto en [neon.tech](https://neon.tech) (región São Paulo o la más cercana).
2. Copia la cadena de conexión (**Connect** → `postgresql://...`) en `DATABASE_URL` de tu `.env.local`.
3. Completa `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_NAME`, y crea las tablas y el administrador:

   ```bash
   npm run db:setup
   ```

### 2. Cloudflare R2 (fotos)

1. En Cloudflare → **R2** → crea un bucket (ej. `geonuble-fotos`).
2. En el bucket → **Settings** → **Public access**: activa la URL `r2.dev` o conecta un dominio propio (recomendado para producción). Esa URL va en `R2_PUBLIC_URL`.
3. En el bucket → **Settings** → **CORS policy**, pega esto (necesario para que las fotos entren al PDF):

   ```json
   [{ "AllowedOrigins": ["https://TU-DOMINIO.cl", "http://localhost:5173"], "AllowedMethods": ["GET"], "AllowedHeaders": ["*"] }]
   ```

4. R2 → **Manage API tokens** → crea un token con permiso *Object Read & Write* para ese bucket. Copia `Access Key ID`, `Secret Access Key` y tu `Account ID`.

### 3. Vercel

1. Sube el proyecto a GitHub e impórtalo en [vercel.com](https://vercel.com) (detecta Vite solo).
2. En **Settings → Environment Variables** agrega todas las variables de `.env.example`: `DATABASE_URL`, `JWT_SECRET` (genera una con `openssl rand -base64 32`), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`.
3. Despliega. Entra a `/panel`, completa **Datos de la empresa** y crea los usuarios de los corredores en **Corredores y usuarios**.

> El plan gratuito *Hobby* de Vercel es para uso no comercial. Para un sitio de empresa corresponde el plan Pro, o publicar en otro hosting que soporte funciones Node.

### 4. Aviso por correo de mensajes nuevos (opcional)

Cada mensaje del formulario de contacto se guarda en el panel y, además, puede llegar por correo:

1. Crea una cuenta gratis en [resend.com](https://resend.com) (3.000 correos/mes) con el correo donde quieres recibir los avisos.
2. **API Keys → Create API Key** (permiso *Sending access*).
3. En `.env.local` y en Vercel agrega `RESEND_API_KEY` y `NOTIFY_EMAIL` (el mismo correo de tu cuenta de Resend) y vuelve a desplegar.

Sin dominio verificado, Resend envía desde `onboarding@resend.dev` y **solo al correo de tu cuenta**. Para enviar a otras direcciones o desde `avisos@tu-dominio.cl`, verifica el dominio en Resend y define `MAIL_FROM`.

Si el envío falla, el mensaje igual queda guardado en **Panel → Mensajes**.

## Límites gratuitos (referencia)

| Servicio | Gratis | Uso aproximado |
|---|---|---|
| Cloudflare R2 | 10 GB guardados, salida de datos sin costo | ~2 MB por propiedad con 8 fotos → miles de propiedades |
| Neon | 0,5 GB por proyecto | Sobra para propiedades, usuarios y cotizaciones |

## Estructura

```
api/            funciones de Vercel (auth, properties, users, upload, quotes, contact, settings)
lib/            código compartido del backend (db, auth, storage, schema)
scripts/        db-setup.js
src/
  pages/        sitio público
  panel/        panel de admin y corredores (se carga aparte)
  components/   Navbar, Footer, PropertyCard, MapView
  lib/          cliente API, formato, imágenes, PDF de cotización, mapa estático
  context/      sesión y datos de la empresa
```
