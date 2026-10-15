import { useState, useEffect } from 'react'
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react'
import { gqlAuth, obtenerCarrito } from '../lib/api.js'

initMercadoPago(import.meta.env.PUBLIC_MP_PUBLIC_KEY, { locale: 'es-MX' })

export default function Checkout() {
  const [cart, setCart] = useState(null)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [pedido, setPedido] = useState(null)       // { id, monto }
  const [resultado, setResultado] = useState(null) // { status, detalle }
  const [form, setForm] = useState({ nombre: '', email: '', direccion: '' })

  useEffect(() => {
    obtenerCarrito().then(setCart).catch((e) => setError(e.message))
  }, [])

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  // Paso 1: crear el pedido con los datos de envío
  const crearPedido = async (e) => {
    e.preventDefault()
    setEnviando(true)
    const lineas = cart.map((i) => `{ productoId: "${i.id}", cantidad: ${i.quantity} }`).join(', ')
    try {
      const d = await gqlAuth(`mutation { crearPedido(datos: { nombreCliente: "${form.nombre}", email: "${form.email}", direccion: "${form.direccion}", lineas: [${lineas}] }) { id total } }`)
      const t = d.crearPedido.total
      setPedido({ id: d.crearPedido.id, monto: t + (t >= 1800 ? 0 : 150) })
    } catch (err) {
      alert('Error: ' + err.message)
    }
    setEnviando(false)
  }

  // Paso 2: el Brick entrega el token de la tarjeta y lo mandamos al back
  const pagar = async (formData) => {
    try {
      const d = await gqlAuth(`mutation { pagarPedido(datos: {
        pedidoId: "${pedido.id}",
        token: ${JSON.stringify(formData.token)},
        paymentMethodId: ${JSON.stringify(formData.payment_method_id)},
        issuerId: ${JSON.stringify(String(formData.issuer_id ?? ''))},
        installments: ${Number(formData.installments) || 1},
        email: ${JSON.stringify(formData.payer?.email ?? form.email)}
      }) { status detalle } }`)
      setResultado(d.pagarPedido)
    } catch (err) {
      setResultado({ status: 'error', detalle: err.message })
    }
  }

  if (error) return <p>Error: {error}</p>
  if (!cart) return <p>Cargando...</p>

  // Resultado final (aprobado o en revisión)
  if (resultado && ['approved', 'in_process', 'pending'].includes(resultado.status)) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 2rem' }}>
        <h1>{resultado.status === 'approved' ? '¡Pago aprobado!' : 'Pago en proceso'}</h1>
        <p style={{ margin: '1rem 0 2rem' }}>{resultado.detalle}</p>
        <a className="backBtn" href="/">Seguir comprando</a>
      </div>
    )
  }

  if (cart.length === 0 && !pedido) {
    return (
      <div>
        <p>Tu carrito esta vacio.</p>
        <a className="primaryBtn" href="/">Ir al Catalogo</a>
      </div>
    )
  }

  // Paso 2 en pantalla: formulario de tarjeta
  if (pedido) {
    return (
      <div className="cartLayout">
        <div className="cartList">
          <h2>Pago con tarjeta</h2>
          <p>Pedido #{pedido.id} — Total: $ {pedido.monto}</p>
          {resultado && (
            <div style={{ margin: '1rem 0' }}>
              <p style={{ color: 'red' }}>{resultado.detalle}</p>
              <button className="backBtn" onClick={() => setResultado(null)}>Intentar con otra tarjeta</button>
            </div>
          )}
          {!resultado && (
            <CardPayment
              initialization={{ amount: pedido.monto }}
              customization={{ paymentMethods: { maxInstallments: 1 } }}
              onSubmit={pagar}
              onError={(e) => console.error('Brick:', e)}
            />
          )}
        </div>
      </div>
    )
  }

  // Paso 1 en pantalla: datos de envío
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const total = subtotal + (subtotal >= 1800 ? 0 : 150)

  return (
    <div className="cartLayout">
      <form className="cartList" onSubmit={crearPedido} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2>Datos de Envio</h2>
        <div><label>Nombre Completo</label><input type="text" name="nombre" required className="inputCO" value={form.nombre} onChange={cambiar} /></div>
        <div><label>Correo Electronico</label><input type="email" name="email" required className="inputCO" placeholder="email" value={form.email} onChange={cambiar} /></div>
        <div><label>Direccion</label><input type="text" name="direccion" required className="inputCO" placeholder="direccion" value={form.direccion} onChange={cambiar} /></div>
        <button type="submit" className="pagarBtn" disabled={enviando} style={{ marginTop: '1.5rem', width: '100%' }}>
          {enviando ? 'Espera...' : `Continuar al pago $ ${total}`}
        </button>
      </form>
    </div>
  )
}