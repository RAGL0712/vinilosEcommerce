import { useState, useEffect } from 'react'
import { getSesion, gql, cerrarSesion } from '../lib/api.js'
import { t, url } from '../i18n/index.js'
import EstadoRed from '../components/EstadoRed.jsx'
import BotonInstalar from '../components/BotonInstalar.jsx'
import SelectorIdioma from '../components/SelectorIdioma.jsx'

// locale: idioma de la pagina | ruta: ruta sin prefijo de idioma (para el selector)
export default function Nav({ locale = 'es', ruta = '/' }) {
  const ui = t(locale)
  const [abierto, setAbierto] = useState(false)
  const [categorias, setCategorias] = useState([])
  const [esAdmin, setEsAdmin] = useState(false)
  const [enPanel, setEnPanel] = useState(false)
  const [notificacion, setNotificacion] = useState(false)

  useEffect(() => {
    if (!getSesion()) {
      location.href = url(locale, '/login')
      return
    }
    setEsAdmin(getSesion().usuario.rol === 'ADMIN')
    setEnPanel(location.pathname.startsWith('/admin'))
    gql('query { obtenerCategorias { id nombre } }')
      .then((d) => setCategorias(d.obtenerCategorias))
      .catch((e) => console.error('Categorias:', e))
  }, [])
  useEffect(() => {
    if (/^\/(en\/)?carrito/.test(location.pathname)) localStorage.removeItem('carritoNuevo')
    const revisar = () => setNotificacion(localStorage.getItem('carritoNuevo') === '1')
    revisar()
    window.addEventListener('carrito-nuevo', revisar)
    return () => window.removeEventListener('carrito-nuevo', revisar)
  }, [])
  return (
    <>
      <header className="topbar">
        <button type="button" className="menuIcon" onClick={() => setAbierto(true)} aria-label={ui.nav.abrirMenu}>☰</button>
        <img src="/logo.webp" className="topbarLogo" alt={ui.nav.logo} width="35" height="35" />
        <span className="topbarMarca">{enPanel ? ui.nav.dashboard : ' VINILO '}</span>
        <SelectorIdioma locale={locale} ruta={ruta} />
        <BotonInstalar locale={locale} />
        <a className="cartIcon" href={url(locale, '/carrito')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={ui.nav.carrito}><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" /></svg>
          {notificacion && <span className="cartDot" />}
        </a>
      </header>
      <EstadoRed locale={locale} />
      <aside className={`sidebar ${abierto ? 'open' : ''}`} aria-hidden={!abierto}>
        <div className="sidebarHeader">
          <h2>{ui.nav.menu}</h2>
          <button type="button" className="closeIcon" onClick={() => setAbierto(false)} aria-label={ui.nav.cerrarMenu}>✕</button>
        </div>
        <nav className="sidebarNav">
          <ul>
            <li><a href={url(locale, '/')}>{ui.nav.home}</a></li>
            {/* El panel de administracion solo existe en espanol */}
            {esAdmin && <li><a href="/admin">{ui.nav.admin}</a></li>}
            {esAdmin && <li><a href="/backoffice">{ui.nav.backoffice}</a></li>}
            <li><a href={url(locale, '/carrito')}>{ui.nav.carrito}</a></li>
            <li><a href={url(locale, '/mis-pedidos')}>{ui.nav.pedidos}</a></li>
            <li onClick={cerrarSesion}>{ui.nav.cerrarSesion}</li>
          </ul>
        </nav>
        <nav className="sidebarCategorias">
          <h3>{ui.nav.categorias}</h3>
          <ul>
            {categorias.map((c) => (
              <li key={c.id}>
                <a href={`${url(locale, '/categoria')}?id=${c.id}&nombre=${encodeURIComponent(c.nombre)}`}>{c.nombre}</a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  )
}
