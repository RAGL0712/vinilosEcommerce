import { useState, useEffect, useRef } from 'react'
import { suscribir } from '../lib/api.js'
import { notificar } from '../lib/offline.js'
import { t, url, FORMATO } from '../i18n/index.js'
import Img from '../components/Img.jsx'

const Q_MIS_PEDIDOS = `subscription { misPedidosEnVivo {
  id nombreCliente email direccion fecha status total
  lineas { id cantidad precioUnitario producto { id titulo artista imagen_url } }
} }`

const PASOS = ['PENDIENTE', 'PAGADO', 'ENVIADO']

// Numeros y fechas segun el idioma de la pagina (es-MX / en-US)
const dinero = (n, locale) => '$' + Number(n).toLocaleString(FORMATO[locale], { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fecha = (iso, locale) => new Date(iso).toLocaleString(FORMATO[locale], { dateStyle: 'medium', timeStyle: 'short' })

function Progreso({ status, ui }) {
  const TEXTO = ui.pedidos.estados
  if (status === 'CANCELADO') return <p className="mpCancelado">{ui.pedidos.cancelado}</p>
  const actual = PASOS.indexOf(status)
  return (
    <ol className="mpProgreso">
      {PASOS.map((p, i) => (
        <li key={p} className={i <= actual ? 'hecho' : ''}>{TEXTO[p]}</li>
      ))}
    </ol>
  )
}

export default function MisPedidos({ locale = 'es' }) {
  const ui = t(locale)
  const TEXTO = ui.pedidos.estados
  const [pedidos, setPedidos] = useState(null)
  const [error, setError] = useState('')

  const anteriores = useRef(null) // estado de cada pedido en el aviso anterior

  useEffect(() => {
    const cancelar = suscribir(
      Q_MIS_PEDIDOS,
      (d) => {
        const lista = d.misPedidosEnVivo
        // Si un pedido cambio de estado, avisar con una notificacion
        if (anteriores.current) {
          lista.forEach((p) => {
            const antes = anteriores.current[p.id]
            if (antes && antes !== p.status) {
              notificar(`${ui.pedidos.pedido} #${p.id}: ${TEXTO[p.status] || p.status}`, {
                body: p.status === 'ENVIADO' ? ui.pedidos.enCamino : ui.pedidos.cambio(TEXTO[p.status] || p.status),
                tag: `pedido-${p.id}`,
                data: { url: url(locale, '/mis-pedidos') },
              })
            }
          })
        }
        anteriores.current = Object.fromEntries(lista.map((p) => [p.id, p.status]))
        setPedidos(lista)
        setError('')
      },
      (e) => setError(ui.pedidos.errorCarga + e)
    )
    return cancelar
  }, [])

  if (error) return <p>{error}</p>
  if (!pedidos) return <p>{ui.pedidos.cargando}</p>
  if (pedidos.length === 0) {
    return (
      <div className="misPedidos">
        <h2>{ui.pedidos.titulo}</h2>
        <p>{ui.pedidos.vacio} <a href={url(locale, '/')}>{ui.pedidos.irTienda}</a></p>
      </div>
    )
  }

  return (
    <div className="misPedidos">
      <h2>{ui.pedidos.titulo}</h2>
      <p className="mpNota">{ui.pedidos.nota}</p>
      {pedidos.map((p) => (
        <article key={p.id} className="mpTarjeta">
          <header className="mpCabecera">
            <div>
              <strong>{ui.pedidos.pedido} #{p.id}</strong>
              <span className="mpFecha">{fecha(p.fecha, locale)}</span>
            </div>
            <span className={`mpEstado mp${p.status}`}>{TEXTO[p.status] || p.status}</span>
          </header>

          <Progreso status={p.status} ui={ui} />

          <div className="mpDatos">
            <p><b>{ui.pedidos.recibe}</b> {p.nombreCliente}</p>
            <p><b>{ui.pedidos.correo}</b> {p.email}</p>
            <p><b>{ui.pedidos.direccion}</b> {p.direccion}</p>
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
                <span className="mpPrecio">{dinero(l.precioUnitario * l.cantidad, locale)}</span>
              </li>
            ))}
          </ul>

          <footer className="mpTotal">{ui.pedidos.total} <strong>{dinero(p.total, locale)}</strong></footer>
        </article>
      ))}
    </div>
  )
}