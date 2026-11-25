import { useState, useEffect } from 'react'
import { gqlAuth, obtenerCarrito } from '../lib/api.js'
import { t, url } from '../i18n/index.js'
import Img from '../components/Img.jsx'

export default function Carrito({ locale = 'es' }) {
  const ui = t(locale)
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
      alert(e.message)
    }
    cargar()
  }

  const quitar = (id) => ejecutar(`mutation { eliminarDelCarrito(productoId: "${id}") }`)
  const cambiar = (id, n) =>
    n <= 0 ? quitar(id) : ejecutar(`mutation { actualizarCantidadItem(productoId: "${id}", cantidad: ${n}) }`)

  if (error) return <p>{ui.error}{error}</p>
  if (!cart) return <p>{ui.cargando}</p>
  if (cart.length === 0) return <p>{ui.carrito.vacio}</p>

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const envio = total >= 1800 ? 0 : 150

  return (
    <div className="cartLayout">
      <div className="cartList">
        {cart.map((i) => (
          <div key={i.id} className="cartItem">
            <Img src={i.cover} alt={i.title} className="cartItemImg" />
            <div className="cartItemDetails">
              <h3>{i.title}</h3>
              <p>{i.artist}</p>
              <span>{i.price} $</span>
            </div>
            <div className="cartQuantity">
              <button className="addBtn" onClick={() => cambiar(i.id, i.quantity - 1)} aria-label={ui.carrito.menos}>-</button>
              <span>{i.quantity}</span>
              <button className="addBtn" onClick={() => cambiar(i.id, i.quantity + 1)} aria-label={ui.carrito.mas}>+</button>
              <button className="removeBtn" onClick={() => quitar(i.id)} aria-label={ui.carrito.quitar}>🗑</button>
            </div>
          </div>
        ))}
      </div>
      <div className="cartSummary">
        <div className="summaryRow"><span>{ui.carrito.costo}</span><span>{total} $</span></div>
        <div className="summaryRow"><span>{ui.carrito.envio}</span><span>{envio === 0 ? ui.carrito.gratis : '150 $'}</span></div>
        <div className="summaryRow totalRow"><span>{ui.carrito.total}</span><span>{total + envio} $</span></div>
        <a className="pagarBtn pagarBloque" href={url(locale, '/checkout')}>{ui.carrito.pagar}</a>
      </div>
    </div>
  )
}
