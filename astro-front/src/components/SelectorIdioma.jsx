import { useState, useEffect } from 'react'
import { LOCALES, HREFLANG, NOMBRE_IDIOMA, t, url, localeDePath, sinLocale, sinBarraFinal } from '../i18n/index.js'

// Selector de idioma: ES | EN.
// `locale` y `ruta` vienen del servidor (sirven para el primer pintado), pero en el
// cliente SIEMPRE se recalculan desde la URL real, asi el idioma activo (y su color)
// nunca depende de un HTML viejo/cacheado ni de una pagina restaurada del historial.
export default function SelectorIdioma({ locale, ruta = '/' }) {
  const [actual, setActual] = useState(locale)
  const [rutaActual, setRutaActual] = useState(ruta)
  const [extra, setExtra] = useState('')

  useEffect(() => {
    const sincronizar = () => {
      setActual(localeDePath(location.pathname))
      setRutaActual(sinBarraFinal(sinLocale(location.pathname)))
      setExtra(location.search + location.hash)
    }
    sincronizar()
    // pageshow: al volver con "atras" el navegador puede restaurar la pagina sin recargarla
    window.addEventListener('pageshow', sincronizar)
    window.addEventListener('popstate', sincronizar)
    window.addEventListener('hashchange', sincronizar)
    return () => {
      window.removeEventListener('pageshow', sincronizar)
      window.removeEventListener('popstate', sincronizar)
      window.removeEventListener('hashchange', sincronizar)
    }
  }, [])

  const cambiar = (e, l) => {
    // clic con Ctrl/Cmd/Shift o boton central: dejamos que el navegador abra el enlace normal
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    if (l === localeDePath(location.pathname)) return // ya estas en ese idioma
    const ruta = sinBarraFinal(sinLocale(location.pathname))
    // search y hash se leen AL HACER CLIC, no antes: asi no se pierde el ?id=...
    location.assign(url(l, ruta) + location.search + location.hash)
  }

  return (
    <nav className="selectorIdioma" aria-label={t(actual).idioma.etiqueta}>
      {LOCALES.map((l) => (
        <a
          key={l}
          href={url(l, rutaActual) + extra}
          lang={HREFLANG[l]}
          hreflang={HREFLANG[l]}
          aria-label={NOMBRE_IDIOMA[l]}
          aria-current={l === actual ? 'true' : undefined}
          className={l === actual ? 'idiomaActivo' : ''}
          onClick={(e) => cambiar(e, l)}
        >
          {l.toUpperCase()}
        </a>
      ))}
    </nav>
  )
}