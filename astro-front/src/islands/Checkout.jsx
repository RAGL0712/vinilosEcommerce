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
  const [form, setForm] = useState({ nombre: '', email: '', calle: '', colonia: '', cp: '', pais: '', estado: '', ciudad: '' })
  const [colonias, setColonias] = useState([])
  const [buscandoCP, setBuscandoCP] = useState(false)
  const [verificada, setVerificada] = useState(null)   // { direccion, lat, lng } cuando Google la valida
  const [verificando, setVerificando] = useState(false)
  const [errorDireccion, setErrorDireccion] = useState('')
  const [ciudadFija, setCiudadFija] = useState(false)

  useEffect(() => {
    obtenerCarrito().then(setCart).catch((e) => setError(e.message))
  }, [])

    const buscarCP = async (cp) => {
    setBuscandoCP(true)
    try {
      const d = await gqlAuth(`query { buscarCodigoPostal(codigoPostal: ${JSON.stringify(cp)}) { encontrado mensaje pais estado ciudad colonias } }`)
      const u = d.buscarCodigoPostal
      if (u.encontrado) {
        setForm((f) => ({ ...f, pais: u.pais || '', estado: u.estado || '', ciudad: u.ciudad || '', colonia: u.colonias.length === 1 ? u.colonias[0] : f.colonia }))
        setColonias(u.colonias)
        setCiudadFija(!!u.ciudad)
      } else {
        setErrorDireccion(u.mensaje)
      }
    } catch (err) {
      setErrorDireccion(err.message)
    }
    setBuscandoCP(false)
  }

  const cambiar = (e) => {
    const { name } = e.target
    let value = e.target.value
    if (name === 'cp') {
      value = value.replace(/\D/g, '').slice(0, 5)
      setForm((f) => ({ ...f, cp: value, pais: '', estado: '', ciudad: '' }))
      setColonias([])
      setCiudadFija(false)
      if (value.length === 5) buscarCP(value)
    } else {
      setForm((f) => ({ ...f, [name]: value }))
    }
      if (['calle', 'colonia', 'ciudad', 'cp'].includes(name)) {
      setVerificada(null)
      setErrorDireccion('')
    }
  }

  const verificarDireccion = async () => {
    setErrorDireccion('')
    if (!/^\d{5}$/.test(form.cp) || !form.estado) { setErrorDireccion('Escribe un codigo postal valido'); return }
    if (!form.calle.trim()) { setErrorDireccion('Escribe la calle y el numero'); return }
    setVerificando(true)
    const texto = [form.calle, form.colonia, form.ciudad, form.estado].filter((x) => x && x.trim()).join(', ')
    try {
      const d = await gqlAuth(`query { validarDireccion(direccion: ${JSON.stringify(texto)}, codigoPostal: ${JSON.stringify(form.cp)}) { valida mensaje direccion lat lng } }`)
      const v = d.validarDireccion
      if (v.valida) setVerificada(v)
      else setErrorDireccion(v.mensaje)
    } catch (err) {
      setErrorDireccion(err.message)
    }
    setVerificando(false)
  }
  
  // Paso 1: crear el pedido con los datos de envío
  const crearPedido = async (e) => {
    e.preventDefault()
    if (!verificada) {
      setErrorDireccion('Primero verifica tu direccion')
      return
    }
    setEnviando(true)
    const lineas = cart.map((i) => `{ productoId: "${i.id}", cantidad: ${i.quantity} }`).join(', ')
    try {
      const d = await gqlAuth(`mutation { crearPedido(datos: { nombreCliente: ${JSON.stringify(form.nombre)}, email: ${JSON.stringify(form.email)}, direccion: ${JSON.stringify(verificada.direccion)}, codigoPostal: ${JSON.stringify(form.cp)}, lineas: [${lineas}] }) { id total } }`)
      const t = d.crearPedido.total
      setPedido({ id: d.crearPedido.id, monto: t + (t >= 1800 ? 0 : 150) })
    } catch (err) {
      alert('Error: ' + err.message)
    }
    setEnviando(false)
  }

  // Paso 2: el Brick entrega el token de la tarjeta y lo mandamos al back
  const pagar = async (formData, additionalData) => {
    try {
      const d = await gqlAuth(`mutation { pagarPedido(datos: {
        pedidoId: "${pedido.id}",
        token: ${JSON.stringify(formData.token)},
        paymentMethodId: ${JSON.stringify(formData.payment_method_id)},
        paymentTypeId: ${JSON.stringify(additionalData?.paymentTypeId || 'credit_card')},
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
        <h1 style={{ marginBottom: '2rem' }}>{resultado.detalle}</h1>
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
        <div><label>Correo Electronico</label><input type="email" name="email" required className="inputCO" placeholder="Aqui te enviaremos el seguimiento de tu pedido" value={form.email} onChange={cambiar} /></div>

        <div className="filaDireccion">
          <div>
            <label>Codigo postal</label>
            <input type="text" inputMode="numeric" name="cp" required className="inputCO" placeholder="44100" maxLength={5} value={form.cp} onChange={cambiar} />
          </div>
          <div>
            <label>Pais</label>
            <input type="text" className="inputCO campoAuto" value={buscandoCP ? 'Buscando...' : form.pais} placeholder="Se llena con el C.P." readOnly tabIndex={-1} />
          </div>
        </div>
        <div className="filaDireccion">
          <div>
            <label>Estado</label>
            <input type="text" className="inputCO campoAuto" value={form.estado} placeholder="Se llena con el C.P." readOnly tabIndex={-1} />
          </div>
          <div>
            <label>Ciudad / Municipio</label>
              <input
              type="text"
              name="ciudad"
              className={`inputCO ${ciudadFija ? 'campoAuto' : ''}`}
              value={form.ciudad}
              onChange={cambiar}
              readOnly={ciudadFija}
              tabIndex={ciudadFija ? -1 : 0}
              placeholder={form.estado && !ciudadFija ? 'Escribe tu ciudad o municipio' : 'Se llena con el C.P.'}
            />
          </div>
        </div>

        <div>
          <label>Colonia</label>
          <input type="text" name="colonia" className="inputCO" list="listaColonias" placeholder="Centro" value={form.colonia} onChange={cambiar} />
          <datalist id="listaColonias">
            {colonias.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div><label>Calle y numero</label><input type="text" name="calle" required className="inputCO" placeholder="Av. Juarez 123" value={form.calle} onChange={cambiar} /></div>

        <button type="button" className="backBtn" onClick={verificarDireccion} disabled={verificando || buscandoCP}>
          {verificando ? 'Verificando...' : verificada ? 'Direccion verificada ✓' : 'Verificar direccion'}
        </button>
        {errorDireccion && <p style={{ color: 'red', margin: 0 }}>{errorDireccion}</p>}
        {verificada && (
          <div className="direccionVerificada">
            <p><strong>Se entregara en:</strong> {verificada.direccion}</p>
            <iframe
              title="Mapa de entrega"
              src={`https://maps.google.com/maps?q=${verificada.lat},${verificada.lng}&z=16&output=embed`}
              loading="lazy"
            />
          </div>
        )}

        <button type="submit" className="pagarBtn" disabled={enviando || !verificada} style={{ marginTop: '1.5rem', width: '100%' }}>
          {enviando ? 'Espera...' : verificada ? `Continuar al pago $ ${total}` : 'Verifica tu direccion para continuar'}
        </button>
      </form>
    </div>
  )
}