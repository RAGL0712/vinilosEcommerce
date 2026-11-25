// Utilidades de idioma. Se usan en Astro (servidor) y en las islas React (cliente),
// por eso NO importan nada de "astro:i18n".
import { ui } from './ui.js'

export const DEFAULT_LOCALE = 'es'
export const LOCALES = ['es', 'en']

// Código que ven los buscadores (hreflang, og:locale) y las APIs de formato
export const HREFLANG = { es: 'es', en: 'en' }
export const OG_LOCALE = { es: 'es_MX', en: 'en_US' }
export const FORMATO = { es: 'es-MX', en: 'en-US' }
export const NOMBRE_IDIOMA = { es: 'Español', en: 'English' }

// Diccionario del idioma (si piden uno que no existe, cae al español)
export const t = (locale) => ui[locale] ?? ui[DEFAULT_LOCALE]

// '/en/producto' -> 'en' | '/producto' -> 'es'
export function localeDePath(pathname = '/') {
  const m = pathname.match(/^\/([a-z]{2})(?=\/|$)/)
  return m && LOCALES.includes(m[1]) && m[1] !== DEFAULT_LOCALE ? m[1] : DEFAULT_LOCALE
}

// '/en/producto' -> '/producto'  |  '/en' -> '/'
export function sinLocale(pathname = '/') {
  const l = localeDePath(pathname)
  if (l === DEFAULT_LOCALE) return pathname || '/'
  return pathname.slice(l.length + 1) || '/'
}

// '/producto/' -> '/producto' (la raiz '/' se queda igual)
export const sinBarraFinal = (ruta) => (ruta.length > 1 ? ruta.replace(/\/+$/, '') : ruta)

// url('en', '/producto') -> '/en/producto/' | url('es', '/producto') -> '/producto/'
// La "/" final evita la redireccion 301 de Netlify (/producto -> /producto/)
export function url(locale, path = '/') {
  let p = path.startsWith('/') ? path : '/' + path
  if (!p.endsWith('/')) p += '/'
  if (locale === DEFAULT_LOCALE) return p
  return p === '/' ? `/${locale}/` : `/${locale}${p}`
}
