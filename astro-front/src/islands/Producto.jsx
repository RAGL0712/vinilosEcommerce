import { useState, useEffect } from 'react'
import { gql, gqlAuth, obtenerCarrito } from '../lib/api.js'

export default function Producto() {
  const [p, setP] = useState(null)
  const [enCarrito, setEnCarrito] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const id = new URLSearchParams(location.search).get('id')
    Promise.all([
      gql(`query { obtenerProducto(id: "${id}") { id titulo artista precio imagen_url stock } }`),
      obtenerCarrito().catch((e) => {
        console.error('Carrito:', e)
        return []
      }),
    ])
      .then(([d, carrito]) => {
        setP(d.obtenerProducto)
        setEnCarrito(carrito.some((i) => i.id === String(d.obtenerProducto.id)))
      })
      .catch((e) => setError(e.message))
  }, [])

  const agregar = async () => {
    try {
      await gqlAuth(`mutation { agregarAlCarrito(productoId: "${p.id}", cantidad: 1) }`)
      setEnCarrito(true)
    } catch (e) {
      alert('Error: ' + e.message)
    }
  }

  if (error) return <p>Error: {error}</p>
  if (!p) return <p>Cargando...</p>

  const sinStock = Number(p.stock) <= 0

  return (
    <div className="productDetail">
      <div className="productImageContainer">
        <img src={p.imagen_url} alt={p.titulo} className="productImage" />
      </div>
      <div className="productInfo">
        <span className="productArtist">{p.artista}</span>
        <h1 className="productTitle">{p.titulo}</h1>
        <h1>${p.precio}</h1>
        <p className="productStock">Stock: {p.stock}</p>
        <button className={`addCartBtn ${enCarrito ? 'added' : ''}`} onClick={agregar} disabled={enCarrito || sinStock}>
          {enCarrito ? 'Producto en el carrito' : sinStock ? 'Sin stock' : 'Agregar al Carrito'}
        </button>
      </div>
    </div>
  )
}
