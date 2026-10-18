import { useState, useEffect } from 'react'
import { gql, gqlAuth, obtenerCarrito, marcarCarritoNuevo } from '../lib/api.js'
import Img from '../components/Img.jsx'

export default function Producto() {
  const [p, setP] = useState(null)
  const [cantidad, setCantidad] = useState(0) // 0 = todavía no le das "Agregar"
  const [guardando, setGuardando] = useState(false)
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
        const item = carrito.find((i) => i.id === String(d.obtenerProducto.id))
        setCantidad(item ? item.quantity : 0)
      })
      .catch((e) => setError(e.message))
  }, [])

  const agregar = async () => {
    setGuardando(true)
    try {
      await gqlAuth(`mutation { agregarAlCarrito(productoId: "${p.id}", cantidad: 1) }`)
      setCantidad(1)
      marcarCarritoNuevo()
    } catch (e) {
      alert('Error: ' + e.message)
    }
    setGuardando(false)
  }

  const cambiarCantidad = async (n) => {
    const stock = Number(p.stock)
    if (n < 1 || n > stock || guardando) return
    setGuardando(true)
    try {
      await gqlAuth(`mutation { actualizarCantidadItem(productoId: "${p.id}", cantidad: ${n}) }`)
      if (n > cantidad) marcarCarritoNuevo()
      setCantidad(n)
    } catch (e) {
      alert('Error: ' + e.message)
    }
    setGuardando(false)
  }

  if (error) return <p>Error: {error}</p>
  if (!p) return <p>Cargando...</p>

  const stock = Number(p.stock)
  const sinStock = stock <= 0

  return (
    <div className="productDetail">
      <div className="productImageContainer">
        <Img src={p.imagen_url} alt={p.titulo} className="productImage" />
      </div>
      <div className="productInfo">
        <span className="productArtist">{p.artista}</span>
        <h1 className="productTitle">{p.titulo}</h1>
        <h1>${p.precio}</h1>
        <p className="productStock">Stock: {p.stock}</p>

        {cantidad === 0 ? (
          <button className="addCartBtn" onClick={agregar} disabled={sinStock || guardando}>
            {sinStock ? 'Sin stock' : 'Agregar al Carrito'}
          </button>
        ) : (
          <>
            <div className="contadorProducto">
              <button onClick={() => cambiarCantidad(cantidad - 1)} disabled={cantidad <= 1 || guardando}>−</button>
              <span>{cantidad}</span>
              <button onClick={() => cambiarCantidad(cantidad + 1)} disabled={cantidad >= stock || guardando}>+</button>
            </div>
            <p className="contadorAviso">
              {cantidad >= stock ? 'Llegaste al máximo disponible' : 'En tu carrito'}
            </p>
          </>
        )}
      </div>
    </div>
  )
}