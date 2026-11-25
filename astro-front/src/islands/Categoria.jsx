import { useState, useEffect } from 'react'
import { gql } from '../lib/api.js'
import { t } from '../i18n/index.js'
import Tarjetas from '../components/Tarjetas.jsx'

export default function Categoria({ locale = 'es' }) {
  const ui = t(locale)
  const [nombre, setNombre] = useState('')
  const [productos, setProductos] = useState([])
  const [estado, setEstado] = useState(ui.cargando)

  useEffect(() => {
    const p = new URLSearchParams(location.search)
    setNombre(p.get('nombre') || '')
    gql(`query { obtenerProductosPorCategoria(categoriaId: "${p.get('id')}") { id titulo artista precio imagen_url stock } }`)
      .then((d) => {
        setProductos(d.obtenerProductosPorCategoria)
        setEstado('')
      })
      .catch((e) => setEstado(ui.error + e.message))
  }, [])

  return (
    <>
      <h1 className="tituloSeccion">{ui.categoria.titulo(nombre)}</h1>
      {estado && <p>{estado}</p>}
      <Tarjetas productos={productos} locale={locale} />
    </>
  )
}
