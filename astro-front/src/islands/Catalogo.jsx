import { useState, useEffect } from 'react'
import { gql } from '../lib/api.js'
import { t } from '../i18n/index.js'
import Tarjetas from '../components/Tarjetas.jsx'

export default function Catalogo({ locale = 'es' }) {
  const ui = t(locale)
  const [productos, setProductos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState(ui.cargando)

  useEffect(() => {
    gql('query { obtenerProductos { id titulo artista precio imagen_url stock } }')
      .then((d) => {
        setProductos(d.obtenerProductos)
        setEstado('')
      })
      .catch((e) => setEstado(ui.error + e.message))
  }, [])

  const q = busqueda.toLowerCase().trim()
  const filtrados = productos.filter((p) => p.titulo.toLowerCase().includes(q) || p.artista.toLowerCase().includes(q))

  return (
    <main className="mainSection">
      <h1 className="tituloSeccion">{ui.catalogo.titulo}</h1>
      <input type="text" placeholder={ui.catalogo.buscar} aria-label={ui.catalogo.buscarAria} className="searchInput" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      {estado && <p>{estado}</p>}
      <Tarjetas productos={filtrados} locale={locale} />
    </main>
  )
}
