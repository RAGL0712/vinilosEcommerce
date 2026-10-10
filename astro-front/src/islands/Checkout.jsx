import { useState, useEffect } from 'react'
import { gqlAuth, obtenerCarrito } from '../lib/api.js'

export default function Checkout() {
  const [cart, setCart] = useState(null)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState(false)
  const [form, setForm] = useState({ nombre: '', email: '', direccion: '' })

  useEffect(() => {
    obtenerCarrito().then(setCart).catch((e) => setError(e.message))
  }, [])

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value })

    const enviar = async (e) => {
    e.preventDefault()
    setEnviando(true)
    const lineas = cart.map((i) => `{ productoId: "${i.id}", cantidad: ${i.quantity} }`).join(', ')
    try {
      const d = await gqlAuth(`mutation { crearPedido(datos: { nombreCliente: "${form.nombre}", email: "${form.email}", direccion: "${form.direccion}", lineas: [${lineas}] }) { id } }`)
      const p = await gqlAuth(`mutation { crearPreferenciaPago(pedidoId: "${d.crearPedido.id}") }`)
      location.href = p.crearPreferenciaPago
    } catch (err) {
      alert('Error: ' + err.message)
      setEnviando(false)
    }
  }

  if (error) return <p>Error: {error}</p>
  if (!cart) return <p>Cargando...</p>

  if (listo) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 2rem' }}>
        <h1>Comprado</h1>
        <a className="backBtn" href="/">Volver</a>
      </div>
    )
  }

  if (cart.length === 0) {
    return (
      <div>
        <p>Tu carrito esta vacio.</p>
        <a className="primaryBtn" href="/">Ir al Catalogo</a>
      </div>
    )
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const total = subtotal + (subtotal >= 1800 ? 0 : 150)

  return (
    <div className="cartLayout">
      <form className="cartList" onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2>Datos de Envio</h2>
        <div><label>Nombre Completo</label><input type="text" name="nombre" required className="inputCO" value={form.nombre} onChange={cambiar} /></div>
        <div><label>Correo Electronico</label><input type="email" name="email" required className="inputCO" placeholder="email" value={form.email} onChange={cambiar} /></div>
        <div><label>Direccion</label><input type="text" name="direccion" required className="inputCO" placeholder="direccion" value={form.direccion} onChange={cambiar} /></div>
        <button type="submit" className="pagarBtn" disabled={enviando} style={{ marginTop: '1.5rem', width: '100%' }}>
          {enviando ? 'Espera...' : `Pagar $ ${total}`}
        </button>
      </form>
    </div>
  )
}
