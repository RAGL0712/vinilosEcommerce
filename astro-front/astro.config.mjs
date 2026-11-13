import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'

// Paginas privadas que no deben aparecer en el sitemap
const PRIVADAS = ['/admin', '/backoffice', '/carrito', '/checkout', '/mis-pedidos', '/login', '/registro']

export default defineConfig({
  site: 'https://vinilosecommerce.netlify.app',
  integrations: [
    react(),
    sitemap({
      filter: (page) => !PRIVADAS.some((ruta) => new URL(page).pathname.startsWith(ruta)),
    }),
  ],
})
