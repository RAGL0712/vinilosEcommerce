import { useState, useEffect } from 'react'
import { getSesion, gql, cerrarSesion } from '../lib/api.js'

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
        <span className="menuIcon" onClick={() => setAbierto(true)}>☰</span>
        <img src="/logo.webp" className="topbarLogo" alt="Logo" />
        <h1>{enPanel ? 'DASHBOARD' : ' VINILO '}</h1>
        <a className="cartIcon" href="/carrito">
          <img src="https://cdn-icons-png.flaticon.com/512/565/565375.png" alt="Carrito" width="24" height="24" />
          {notificacion && <span className="cartDot" />}
        </a>
      </header>

      <aside className={`sidebar ${abierto ? 'open' : ''}`}>
        <div className="sidebarHeader">
          <h2>Menu</h2>
          <span className="closeIcon" onClick={() => setAbierto(false)}>✕</span>
        </div>
        <nav className="sidebarNav">
          <ul>
            <li><a href="/">Home</a></li>
            {esAdmin && <li><a href="/admin">Admin dashboard</a></li>}
            <li><a href="/carrito">Carrito</a></li>
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