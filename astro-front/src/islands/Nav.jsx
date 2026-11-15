import { useState, useEffect } from 'react'
import { getSesion, gql, cerrarSesion } from '../lib/api.js'
import EstadoRed from '../components/EstadoRed.jsx'
import BotonInstalar from '../components/BotonInstalar.jsx'

export default function Nav() {
  const [abierto, setAbierto] = useState(false)
  const [categorias, setCategorias] = useState([])
  const [esAdmin, setEsAdmin] = useState(false)
  const [enPanel, setEnPanel] = useState(false)
  const [notificacion, setNotificacion] = useState(false)

  useEffect(() => {
    if (!getSesion()) {
      location.href = '/login'
      return
    }
    setEsAdmin(getSesion().usuario.rol === 'ADMIN')
    setEnPanel(location.pathname.startsWith('/admin'))
    gql('query { obtenerCategorias { id nombre } }')
      .then((d) => setCategorias(d.obtenerCategorias))
      .catch((e) => console.error('Categorias:', e))
  }, [])
  useEffect(() => {
    if (location.pathname.startsWith('/carrito')) localStorage.removeItem('carritoNuevo')
    const revisar = () => setNotificacion(localStorage.getItem('carritoNuevo') === '1')
    revisar()
    window.addEventListener('carrito-nuevo', revisar)
    return () => window.removeEventListener('carrito-nuevo', revisar)
  }, [])
  return (
    <>
      <header className="topbar">
        <button type="button" className="menuIcon" onClick={() => setAbierto(true)} aria-label="Abrir menu">☰</button>
        <img src="/logo.webp" className="topbarLogo" alt="Logo" />
        <span className="topbarMarca">{enPanel ? 'DASHBOARD' : ' VINILO '}</span>
        <BotonInstalar />
        <a className="cartIcon" href="/carrito">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Carrito"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" /></svg>
          {notificacion && <span className="cartDot" />}
        </a>
      </header>
      <EstadoRed />
      <aside className={`sidebar ${abierto ? 'open' : ''}`}>
        <div className="sidebarHeader">
          <h2>Menu</h2>
          <span className="closeIcon" onClick={() => setAbierto(false)}>✕</span>
        </div>
        <nav className="sidebarNav">
          <ul>
            <li><a href="/">Home</a></li>
            {esAdmin && <li><a href="/admin">Admin dashboard</a></li>}
            {esAdmin && <li><a href="/backoffice">Backoffice</a></li>}
            <li><a href="/carrito">Carrito</a></li>
            <li><a href="/mis-pedidos">Mis pedidos</a></li>
            <li onClick={cerrarSesion}>Cerrar sesion</li>
          </ul>
        </nav>
        <nav className="sidebarCategorias">
          <h3>Categorias</h3>
          <ul>
            {categorias.map((c) => (
              <li key={c.id}>
                <a href={`/categoria?id=${c.id}&nombre=${encodeURIComponent(c.nombre)}`}>{c.nombre}</a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  )
}