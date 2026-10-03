import { useState, useEffect } from 'react'
import { gqlAuth, obtenerCarrito } from '../lib/api.js'

export default function Carrito() {
  const [cart, setCart] = useState(null)
  const [error, setError] = useState('')

  const cargar = () => obtenerCarrito().then(setCart).catch((e) => setError(e.message))

  useEffect(() => {
    cargar()
  }, [])

  const ejecutar = async (query) => {
    try {
      await gqlAuth(query)
    } catch (e) {
      setError(e.message)
    }
    cargar()
  }

  const quitar = (id) => ejecutar(`mutation { eliminarDelCarrito(productoId: "${id}") }`)
  const cambiar = (id, n) =>
    n <= 0 ? quitar(id) : ejecutar(`mutation { actualizarCantidadItem(productoId: "${id}", cantidad: ${n}) }`)

  if (error) return <p>Error: {error}</p>
  if (!cart) return <p>Cargando...</p>
  if (cart.length === 0) return <p>El carrito esta vacio</p>

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const envio = total >= 1800 ? 0 : 150

  return (
    <div className="cartLayout">
      <div className="cartList">
        {cart.map((i) => (
          <div key={i.id} className="cartItem">
            <img src={i.cover} alt={i.title} className="cartItemImg" />
            <div className="cartItemDetails">
              <h3>{i.title}</h3>
              <p>{i.artist}</p>
              <span>{i.price} $</span>
            </div>
            <div className="cartQuantity">
              <button className="addBtn" onClick={() => cambiar(i.id, i.quantity - 1)}>-</button>
              <span>{i.quantity}</span>
              <button className="addBtn" onClick={() => cambiar(i.id, i.quantity + 1)}>+</button>
              <button className="removeBtn" onClick={() => quitar(i.id)}>🗑</button>
            </div>
          </div>
        ))}
      </div>
      <div className="cartSummary">
        <div className="summaryRow"><span>Costo:</span><span>{total} $</span></div>
        <div className="summaryRow"><span>Envio:</span><span>{envio === 0 ? 'GRATIS' : '150 $'}</span></div>
        <div className="summaryRow totalRow"><span>Total:</span><span>{total + envio} $</span></div>
        <a className="pagarBtn" href="/checkout" style={{ display: 'block', textAlign: 'center', width: '100%', marginTop: '1.5rem' }}>Pagar</a>
      </div>
    </div>
  )
}
