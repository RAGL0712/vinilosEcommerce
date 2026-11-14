import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import AstroPWA from '@vite-pwa/astro'

// Paginas privadas que no deben aparecer en el sitemap
const PRIVADAS = ['/admin', '/backoffice', '/carrito', '/checkout', '/mis-pedidos', '/login', '/registro']

export default defineConfig({
  site: 'https://vinilosecommerce.netlify.app',
  build: {
    inlineStylesheets: 'always'
  },
  integrations: [
    react(),
    sitemap({
      filter: (page) => !PRIVADAS.some((ruta) => new URL(page).pathname.startsWith(ruta)),
    }),
    AstroPWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.webp', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'VINILO - Tienda de discos de vinilo',
        short_name: 'VINILO',
        description: 'Tienda en línea de discos de vinilo.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#000000',
        background_color: '#ffffff',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: null,
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'paginas',
              networkTimeoutSeconds: 4
            }
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ]
})
