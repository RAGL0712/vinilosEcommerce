import { useState, useEffect } from 'react'
import { gql, gqlAuth, obtenerCarrito, marcarCarritoNuevo, urlImagen } from '../lib/api.js'
import { guardarPendiente } from '../lib/offline.js'
import { t } from '../i18n/index.js'
import Img from '../components/Img.jsx'
import SpotifyPlayer from '../components/SpotifyPlayer.jsx'

export default function Producto({ locale = 'es' }) {
  const ui = t(locale)
  const [p, setP] = useState(null)
  const [cantidad, setCantidad] = useState(0) // 0 = todavía no le das "Agregar"
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const id = new URLSearchParams(location.search).get('id')
    Promise.all([
      gql(`query { obtenerProducto(id: "${id}") { id titulo artista precio imagen_url stock spotify_uri categoria { nombre } } }`),
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

  // SEO: titulo de la pagina y datos estructurados (JSON-LD Product) del disco
  useEffect(() => {
    if (!p) return
    document.title = `${p.titulo} - ${p.artista} | VINILO`.slice(0, 60)
    const datos = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.titulo,
      image: [urlImagen(p.imagen_url)],
      description: ui.producto.descripcionSEO(p.titulo, p.artista),
      sku: String(p.id),
      brand: { '@type': 'Brand', name: p.artista },
      category: p.categoria?.nombre,
      offers: {
        '@type': 'Offer',
        url: location.href,
        priceCurrency: 'MXN',
        price: Number(p.precio).toFixed(2),
        itemCondition: 'https://schema.org/NewCondition',
        availability: Number(p.stock) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      },
    }
    document.getElementById('jsonld-producto')?.remove()
    const s = document.createElement('script')
    s.type = 'application/ld+json'
    s.id = 'jsonld-producto'
    s.textContent = JSON.stringify(datos)
    document.head.appendChild(s)
  }, [p])

  const agregar = async () => {
    setGuardando(true)
    const query = `mutation { agregarAlCarrito(productoId: "${p.id}", cantidad: 1) }`
    try {
      await gqlAuth(query)
      setCantidad(1)
      marcarCarritoNuevo()
    } catch (e) {
      const sinRed = !navigator.onLine || e instanceof TypeError || e.message.startsWith('Sin conexión')
      if (sinRed) {
        // Background Sync: se guarda y se envia solo cuando vuelva el internet
        await guardarPendiente({ query, titulo: p.titulo, idioma: locale })
        alert(ui.producto.sinConexion(p.titulo))
      } else {
        alert(ui.error + e.message)
      }
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
      alert(ui.error + e.message)
    }
    setGuardando(false)
  }

  if (error) return <p>{ui.error}{error}</p>
  if (!p) return <p>{ui.cargando}</p>

  const stock = Number(p.stock)
  const sinStock = stock <= 0

  return (
    <div className="productDetail">
      <div className="productImageContainer">
        <Img src={p.imagen_url} alt={ui.producto.portada(p.titulo, p.artista)} className="productImage" width={600} height={600} fetchPriority="high" />
        <SpotifyPlayer
          locale={locale}
          uri={p.spotify_uri}
          titulo={p.titulo}
          artista={p.artista}
          portada={urlImagen(p.imagen_url)}
          etiquetas={[p.categoria?.nombre, ui.producto.etiqueta].filter(Boolean)}
        />
      </div>
      <div className="productInfo">
        <span className="productArtist">{p.artista}</span>
        <h1 className="productTitle">{p.titulo}</h1>
        <p className="productPrecio">${p.precio}</p>
        <p className="productStock">{ui.producto.stock} {p.stock}</p>

        {cantidad === 0 ? (
          <button className="addCartBtn" onClick={agregar} disabled={sinStock || guardando}>
            {sinStock ? ui.producto.sinStock : ui.producto.agregar}
          </button>
        ) : (
          <>
            <div className="contadorProducto">
              <button onClick={() => cambiarCantidad(cantidad - 1)} disabled={cantidad <= 1 || guardando}>−</button>
              <span>{cantidad}</span>
              <button onClick={() => cambiarCantidad(cantidad + 1)} disabled={cantidad >= stock || guardando}>+</button>
            </div>
            <p className="contadorAviso">
              {cantidad >= stock ? ui.producto.maximo : ui.producto.enCarrito}
            </p>
          </>
        )}
      </div>
    </div>
  )
}