import { useState, useEffect } from 'react'
import { t } from '../i18n/index.js'

// Cada cambio de idioma es una pagina nueva y el navegador NO siempre vuelve a
// lanzar "beforeinstallprompt" en ella. Por eso recordamos que la app es instalable
// (localStorage) y el boton se queda visible hasta que se instale de verdad.
const CLAVE_INSTALABLE = 'viniloInstalable'
const CLAVE_INSTALADA = 'viniloInstalada'

const AYUDA = {
  es: {
    ios: 'Para instalar: toca el botón Compartir y elige "Agregar a pantalla de inicio".',
    otro: 'Para instalar: abre el menú del navegador (⋮) y elige "Instalar app" o "Agregar a pantalla de inicio".',
  },
  en: {
    ios: 'To install: tap the Share button and choose "Add to Home Screen".',
    otro: 'To install: open the browser menu (⋮) and choose "Install app" or "Add to Home Screen".',
  },
}

const leer = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const guardar = (k, v) => { try { localStorage.setItem(k, v) } catch {} }
const borrar = (k) => { try { localStorage.removeItem(k) } catch {} }

const esIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

const esAppInstalada = () =>
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true

export default function BotonInstalar({ locale = 'es' }) {
  const [evento, setEvento] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (esAppInstalada()) return // ya es la app instalada

    // Si el navegador lanzo el evento, es que la app NO esta instalada: se limpia la marca vieja
    const alPoderInstalar = () => {
      borrar(CLAVE_INSTALADA)
      guardar(CLAVE_INSTALABLE, '1')
      setEvento(window.__eventoInstalar || null)
      setVisible(true)
    }
    const alInstalar = () => {
      borrar(CLAVE_INSTALABLE)
      guardar(CLAVE_INSTALADA, '1')
      setEvento(null)
      setVisible(false)
    }

    // Evento que llego antes de que React cargara (lo guarda Layout.astro)
    if (window.__eventoInstalar) alPoderInstalar()
    // Sin evento (pagina nueva tras cambiar de idioma, o iOS): usamos lo recordado
    else if (leer(CLAVE_INSTALADA) !== '1' && (leer(CLAVE_INSTALABLE) === '1' || esIOS())) setVisible(true)

    window.addEventListener('vinilo-instalable', alPoderInstalar)
    window.addEventListener('vinilo-instalada', alInstalar)
    return () => {
      window.removeEventListener('vinilo-instalable', alPoderInstalar)
      window.removeEventListener('vinilo-instalada', alInstalar)
    }
  }, [])

  if (!visible) return null

  const instalar = async () => {
    const ev = evento || window.__eventoInstalar
    if (!ev) {
      // No hay evento disponible: explicamos como instalar a mano
      alert(AYUDA[locale === 'en' ? 'en' : 'es'][esIOS() ? 'ios' : 'otro'])
      return
    }
    ev.prompt()
    const { outcome } = await ev.userChoice
    window.__eventoInstalar = null // el evento solo se puede usar una vez
    setEvento(null)
    if (outcome === 'accepted') {
      borrar(CLAVE_INSTALABLE)
      setVisible(false)
    } // si lo cancela, el boton se queda para intentarlo de nuevo
  }

  return (
    <button type="button" className="botonInstalar" onClick={instalar}>
      {t(locale).instalar}
    </button>
  )
}