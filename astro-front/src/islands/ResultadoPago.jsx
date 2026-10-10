import { useState, useEffect } from 'react'

const mensajes = {
  approved: ['¡Pago aprobado!', 'Tu pedido fue pagado. Gracias por tu compra.'],
  pending: ['Pago pendiente', 'Tu pago se está procesando. Te avisaremos cuando se confirme.'],
  in_process: ['Pago en revisión', 'Mercado Pago está revisando tu pago.'],
  rejected: ['Pago rechazado', 'No se pudo completar el pago. Intenta con otro método.'],
}

export default function ResultadoPago() {
  const [estado, setEstado] = useState(null)

  useEffect(() => {
    setEstado(new URLSearchParams(location.search).get('status') || 'null')
  }, [])

  if (estado === null) return <p>Cargando...</p>

  const [titulo, texto] = mensajes[estado] || ['Pago cancelado', 'No se realizó ningún cobro. Tu carrito sigue guardado.']

  return (
    <div style={{ textAlign: 'center', padding: '5rem 2rem' }}>
      <h1>{titulo}</h1>
      <p style={{ margin: '1rem 0 2rem' }}>{texto}</p>
      {estado === 'approved'
        ? <a className="backBtn" href="/">Seguir comprando</a>
        : <a className="primaryBtn" href="/carrito">Volver al carrito</a>}
    </div>
  )
}