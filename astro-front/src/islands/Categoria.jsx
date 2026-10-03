import { useState, useEffect } from 'react'
import { gql } from '../lib/api.js'
import Tarjetas from '../components/Tarjetas.jsx'

export default function Categoria() {
  const [nombre, setNombre] = useState('')
  const [productos, setProductos] = useState([])
  const [estado, setEstado] = useState('Cargando...')

  useEffect(() => {
    const p = new URLSearchParams(location.search)
    setNombre(p.get('nombre') || '')
    gql(`query { obtenerProductosPorCategoria(categoriaId: "${p.get('id')}") { id titulo artista precio imagen_url stock } }`)
      .then((d) => {
        setProductos(d.obtenerProductosPorCategoria)
        setEstado('')
      })
      .catch((e) => setEstado('Error: ' + e.message))
  }, [])

  return (
    <>
      <h2>Categoria: {nombre}</h2>
      {estado && <p>{estado}</p>}
      <Tarjetas productos={productos} />
    </>
  )
}
