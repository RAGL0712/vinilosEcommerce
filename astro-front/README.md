# Comandos

    npm install
    npm run dev      # http://localhost:4321  
    npm run build


# P12 · Tienda en cualquier pantalla e idioma (Unidad 3.4)

## Multi-idioma (Astro i18n)

- `astro.config.mjs`: `defaultLocale: 'es'`, `locales: ['es','en']`, `prefixDefaultLocale: false`.
- Español sin prefijo (`/producto`), inglés con prefijo (`/en/producto`). Mismas rutas en los dos idiomas.
- `src/pages/*.astro` y `src/pages/en/*.astro` son archivos de 3 líneas que montan la misma vista de `src/views/`.
- Textos: `src/i18n/ui.js` (diccionario es/en). Utilidades: `src/i18n/index.js` (`t`, `url`, `sinLocale`, `localeDePath`).
- `Layout.astro`: `<html lang>`, `<link rel="alternate" hreflang>` (es, en, x-default), `og:locale`, y manifiesto por idioma (`public/manifest-en.webmanifest`).
- Selector de idioma: `components/SelectorIdioma.jsx` (conserva `?id=...` al cambiar).
- El sitemap incluye los alternos `hreflang` de cada página.
- Solo `/admin` y `/backoffice` quedan en español (herramienta interna). Los datos que vienen de la BD (títulos, artistas, categorías) y los mensajes de error del backend no se traducen.

## Pantallas (mobile-first)

- Viewport: `width=device-width, initial-scale=1, viewport-fit=cover`.
- `styles/index.css`: base = 360px; `@media (min-width: 768px)` y `(min-width: 1200px)`. Catálogo 1 / 3 / 4 columnas.
- Orientación: `@media (orientation: landscape) and (max-height: 500px)` y `(orientation: portrait)`. Alturas con `dvh` (hero, menú, login, body).
- Safe areas: variables `--sa-*` = `env(safe-area-inset-*)` aplicadas a body, barra superior, menú lateral, footer y login.
- PWA instalada: `@media (display-mode: standalone)` deja la barra superior fija.

## Cómo probar en la ventana de la PWA instalada (requisito 7)

1. `npm run build && npm run preview`, abrir en Chrome/Edge e instalar con el botón **Instalar app**.
2. En la ventana de la app, redimensionar a ~360, ~768 y ~1200 px de ancho: no debe aparecer scroll horizontal.
3. Cambiar ES ⇄ EN: la ventana debe seguir en modo app (sin barra de URL) y conservar `?id=`.
4. Probar en el teléfono (o DevTools → dispositivo con notch) en vertical y horizontal.
5. DevTools → Network → Offline: una página visitada carga; una nueva muestra `offline.html` en el idioma de la ruta.
