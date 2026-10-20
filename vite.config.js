import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

// En desarrollo, sirve las funciones de /api igual que Vercel:
// /api/properties -> api/properties.js, exportando GET/POST/PUT/DELETE.
function localApi() {
  return {
    name: 'local-api',
    configureServer(server) {
      // Fotos subidas en local (sin R2). Vite no sirve archivos creados en public/ tras arrancar.
      server.middlewares.use('/uploads', async (req, res, next) => {
        const file = decodeURIComponent(req.url.split('?')[0])
        if (file.includes('..')) return next()
        try {
          const data = await readFile(path.join('public', 'uploads', file))
          const types = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }
          res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream')
          res.end(data)
        } catch {
          res.statusCode = 404
          res.end()
        }
      })

      server.middlewares.use('/api', async (req, res, next) => {
        const name = req.url.split('?')[0].replace(/^\/+|\/+$/g, '')
        if (!/^[a-z-]+$/.test(name)) return next()

        try {
          const mod = await server.ssrLoadModule(`/api/${name}.js`)
          const handler = mod[req.method]
          if (!handler) {
            res.statusCode = 405
            return res.end()
          }

          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const body = ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks)
          const request = new Request(`http://${req.headers.host}${req.originalUrl}`, {
            method: req.method,
            headers: req.headers,
            body,
          })

          const response = await handler(request)
          res.statusCode = response.status
          response.headers.forEach((value, key) => {
            if (key !== 'set-cookie') res.setHeader(key, value)
          })
          const cookies = response.headers.getSetCookie()
          if (cookies.length) res.setHeader('Set-Cookie', cookies)
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (err) {
          if (err.code === 'ERR_LOAD_URL') return next()
          console.error(err)
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'Error interno del servidor' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Las funciones de /api leen process.env, como en Vercel.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [react(), localApi()],
    // Evita recargas al abrir por primera vez el panel o un mapa en desarrollo.
    optimizeDeps: { include: ['leaflet', 'jspdf'] },
    server: {
      watch: { ignored: ['**/.data/**', '**/public/uploads/**'] },
    },
  }
})
