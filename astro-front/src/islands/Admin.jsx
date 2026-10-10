import { useState, useEffect } from 'react'
import { getSesion, gqlAuth } from '../lib/api.js'

const QUERY = `query { estadisticasAdmin {
  totalUsuarios totalAdmins totalClientes totalPedidos
  promedioProductosCarrito promedioPrecioProductos ingresosTotales productoMasVendido
  pedidosPorDia { fecha pedidos }
  usuariosRecientes { id nombre email rol }
} }`

function Barras({ datos }) {
  const max = Math.max(...datos.map((d) => d.valor), 1)
  return (
    <svg viewBox="0 0 300 160" width="100%">
      {datos.map((d, i) => {
        const h = (d.valor / max) * 100
        const x = 40 + i * 120
        return (
          <g key={d.nombre}>
            <rect x={x} y={130 - h} width="80" height={h} fill="#000" />
            <text x={x + 40} y={124 - h} textAnchor="middle" fontSize="12">{d.valor}</text>
            <text x={x + 40} y="148" textAnchor="middle" fontSize="12">{d.nombre}</text>
          </g>
        )
      })}
    </svg>
  )
}

function Linea({ datos }) {
  if (datos.length === 0) return <p>Sin pedidos todavia</p>
  const max = Math.max(...datos.map((d) => d.pedidos), 1)
  const paso = datos.length > 1 ? 260 / (datos.length - 1) : 0
  const puntos = datos.map((d, i) => ({
    ...d,
    x: datos.length > 1 ? 20 + i * paso : 150,
    y: 120 - (d.pedidos / max) * 90,
  }))
  return (
    <svg viewBox="0 0 300 160" width="100%">
      <line x1="20" y1="120" x2="280" y2="120" stroke="#999" />
      <polyline points={puntos.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#000" strokeWidth="2" />
      {puntos.map((p) => (
        <g key={p.fecha}>
          <circle cx={p.x} cy={p.y} r="4" fill="#000" />
          <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="10">{p.pedidos}</text>
          <text x={p.x} y="138" textAnchor="middle" fontSize="9">{p.fecha.slice(5)}</text>
        </g>
      ))}
    </svg>
  )
}

export default function Admin() {
  const [e, setE] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const s = getSesion()
    if (!s) { location.href = '/login'; return }
    if (s.usuario.rol !== 'ADMIN') { location.href = '/'; return }
    gqlAuth(QUERY)
      .then((d) => setE(d.estadisticasAdmin))
      .catch((err) => setError(err.message))
  }, [])

  if (error) return <p style={{ color: 'red', padding: 20 }}>{error}</p>
  if (!e) return <p style={{ padding: 20 }}>Cargando...</p>

  const caja = { flex: 1, minWidth: 280 }

  return (
    <main className="estadisticasMain">

      <div className = "grid-estadisticas-1">

      <ul style={{ lineHeight: 2, listStylePosition: 'inside' } }className="estadisticas1">
        <ul className="estadisticas1-box">PROMEDIO DE PRODUCTOS EN EL CARRITO <p className = "estadisticasI">{e.promedioProductosCarrito.toFixed(1)}</p></ul>
        <ul className="estadisticas1-box">COSTO PROMEDIO <p className = "estadisticasI">${e.promedioPrecioProductos.toFixed(1)}</p></ul>
        <ul className="estadisticas1-box">INGRESOS TOTALES <p className = "estadisticasI">${e.ingresosTotales.toFixed(1)}</p></ul>
        <ul className="estadisticas1-box">PRODUCTO MAS VENDIDO <p className = "estadisticasI">{e.productoMasVendido}</p></ul>
      </ul>

      <div className="estadisticas2">
        <h3>TOTAL DE USUARIOS: {e.totalUsuarios}</h3>
        <Barras datos={[
          { nombre: 'Clientes', valor: e.totalClientes },
          { nombre: 'Admins', valor: e.totalAdmins },
        ]} />
      </div>

    </div>



    <div className = "grid-estadisticas-2">

      <div className="estadisticas3">
        <h3>TOTAL DE PEDIDOS: {e.totalPedidos}</h3>
        <Linea datos={e.pedidosPorDia} />
      </div>



      <div className="estadisticas3">
        <h3 className="estadisticasTitulo">USUARIOS RECIENTES</h3>
        <ul style={{ lineHeight: 2, listStylePosition: 'inside' }} >
          {e.usuariosRecientes.map((u) => (
            <ul className="estadisticasUsuarios">{u.nombre}  {u.email} ({u.rol})</ul>
          ))}
        </ul>
      </div>
    </div>

      



    </main>
  )
}