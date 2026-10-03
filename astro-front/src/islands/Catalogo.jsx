import { useState, useEffect } from 'react'
import { gql } from '../lib/api.js'
import Tarjetas from '../components/Tarjetas.jsx'

export default function Catalogo() {
  const [productos, setProductos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('Cargando...')

  useEffect(() => {
    gql('query { obtenerProductos { id titulo artista precio imagen_url stock } }')
      .then((d) => {
        setProductos(d.obtenerProductos)
        setEstado('')
      })
      .catch((e) => setEstado('Error: ' + e.message))
  }, [])

  const t = busqueda.toLowerCase().trim()
  const filtrados = productos.filter((p) => p.titulo.toLowerCase().includes(t) || p.artista.toLowerCase().includes(t))

  return (
    <main className="mainSection">
      <h2>Vinilos</h2>
      <input type="text" placeholder="Buscar" className="searchInput" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      {estado && <p>{estado}</p>}
      <Tarjetas productos={filtrados} />
    </main>
  )
}
