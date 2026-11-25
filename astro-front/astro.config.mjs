import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import AstroPWA from '@vite-pwa/astro'

// Paginas privadas que no deben aparecer en el sitemap
const PRIVADAS = ['/admin', '/backoffice', '/carrito', '/checkout', '/mis-pedidos', '/login', '/registro']

// Quita el prefijo de idioma ('/en/carrito' -> '/carrito') para comparar con PRIVADAS
const sinPrefijo = (ruta) => ruta.replace(/^\/en(?=\/|$)/, '') || '/'

export default defineConfig({
  site: 'https://vinilosecommerce.netlify.app',
  build: {
    inlineStylesheets: 'always'
  },
  // i18n nativo de Astro: espanol sin prefijo (/producto) e ingles con prefijo (/en/producto)
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
    routing: {
      prefixDefaultLocale: false
    }
  },
  integrations: [
    react(),
    sitemap({
      // Agrega los <xhtml:link hreflang> entre la version es y la en de cada pagina
      i18n: { defaultLocale: 'es', locales: { es: 'es', en: 'en' } },
      filter: (page) => !PRIVADAS.some((ruta) => sinPrefijo(new URL(page).pathname).startsWith(ruta)),
    }),
    AstroPWA({
      // Service Worker propio: src/sw.js
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      includeAssets: ['logo.webp', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'VINILO - Tienda de discos de vinilo',
        short_name: 'VINILO',
        description: 'Tienda en línea de discos de vinilo.',
        lang: 'es',
        id: '/',
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
      injectManifest: {
        // Archivos del shell que se guardan al instalar
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2,ico}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024
      },
      devOptions: {
        enabled: false
      }
    })
  ]
})