import { useState, useEffect } from 'react'
import { suscribir } from '../lib/api.js'
import Img from '../components/Img.jsx'

const Q_MIS_PEDIDOS = `subscription { misPedidosEnVivo {
  id nombreCliente email direccion fecha status total
  lineas { id cantidad precioUnitario producto { id titulo artista imagen_url } }
} }`

const PASOS = ['PENDIENTE', 'PAGADO', 'ENVIADO']
const TEXTO = { PENDIENTE: 'Pendiente de pago', PAGADO: 'Pagado', ENVIADO: 'Enviado', CANCELADO: 'Cancelado' }

const dinero = (n) => '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fecha = (iso) => new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

function Progreso({ status }) {
  if (status === 'CANCELADO') return <p className="mpCancelado">Este pedido fue cancelado.</p>
  const actual = PASOS.indexOf(status)
  return (
    <ol className="mpProgreso">
      {PASOS.map((p, i) => (
        <li key={p} className={i <= actual ? 'hecho' : ''}>{TEXTO[p]}</li>
      ))}
    </ol>
  )
}

export default function MisPedidos() {
  const [pedidos, setPedidos] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const cancelar = suscribir(
      Q_MIS_PEDIDOS,
      (d) => { setPedidos(d.misPedidosEnVivo); setError('') },
      (e) => setError('No se pudieron cargar tus pedidos: ' + e)
    )
    return cancelar
  }, [])

  if (error) return <p>{error}</p>
  if (!pedidos) return <p>Cargando tus pedidos...</p>
  if (pedidos.length === 0) {
    return (
      <div className="misPedidos">
        <h2>Mis pedidos</h2>
        <p>Aun no tienes pedidos. <a href="/">Ir a la tienda</a></p>
      </div>
    )
  }

  return (
    <div className="misPedidos">
      <h2>Mis pedidos</h2>
      <p className="mpNota">Se actualiza solo cuando cambia el estado de tu pedido.</p>
      {pedidos.map((p) => (
        <article key={p.id} className="mpTarjeta">
          <header className="mpCabecera">
            <div>
              <strong>Pedido #{p.id}</strong>
              <span className="mpFecha">{fecha(p.fecha)}</span>
            </div>
            <span className={`mpEstado mp${p.status}`}>{TEXTO[p.status] || p.status}</span>
          </header>

          <Progreso status={p.status} />

          <div className="mpDatos">
            <p><b>Recibe:</b> {p.nombreCliente}</p>
            <p><b>Correo:</b> {p.email}</p>
            <p><b>Direccion:</b> {p.direccion}</p>
          </div>

          <ul className="mpLineas">
            {p.lineas.map((l) => (
              <li key={l.id}>
                <Img className="mpPortada" src={l.producto.imagen_url} alt={l.producto.titulo} />
                <div className="mpVinilo">
                  <strong>{l.producto.titulo}</strong>
                  <span>{l.producto.artista}</span>
                </div>
                <span className="mpCantidad">x{l.cantidad}</span>
                <span className="mpPrecio">{dinero(l.precioUnitario * l.cantidad)}</span>
              </li>
            ))}
          </ul>

          <footer className="mpTotal">Total: <strong>{dinero(p.total)}</strong></footer>
        </article>
      ))}
    </div>
  )
}