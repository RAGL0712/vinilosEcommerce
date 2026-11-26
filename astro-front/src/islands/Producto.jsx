import { useState, useEffect } from 'react'
import { gql, gqlAuth, obtenerCarrito, marcarCarritoNuevo, urlImagen, Q_CATALOGO } from '../lib/api.js'
import { guardarPendiente } from '../lib/offline.js'
import { t } from '../i18n/index.js'
import Img from '../components/Img.jsx'
import SpotifyPlayer from '../components/SpotifyPlayer.jsx'

// El SW respondio "sin conexion" (o no hay red): la ficha de este disco no esta guardada
const esSinRed = (e) => !navigator.onLine || e instanceof TypeError || /^(Sin conexión|You're offline)/.test(e.message)

// Caja en lugar del reproductor de Spotify cuando no hay red
function ReproductorNoDisponible({ ui, cargando = false }) {
  return (
    <div className="reproductorNoDisponible">
      <div className="skel skelCirculo" aria-hidden="true" />
      <div className="skelTextos">
        {cargando ? <div className="skel skelLinea" aria-hidden="true" /> : <p>{ui.producto.reproductorNoDisponible}</p>}
        <div className="skel skelLinea corta" aria-hidden="true" />
      </div>
    </div>
  )
}

// Bloques grises animados mientras no hay datos
function Skeleton({ previa, ui }) {
  return (
    <div className="productDetail productoSkeleton" aria-busy={!previa}>
      <div className="productImageContainer">
        {previa ? (
          <Img src={previa.imagen_url} alt={ui.producto.portada(previa.titulo, previa.artista)} className="productImage" width={600} height={600} />
        ) : (
          <div className="skel skelPortada" aria-hidden="true" />
        )}
        <ReproductorNoDisponible ui={ui} cargando={!previa} />
      </div>
      <div className="productInfo">
        {previa ? <h1 className="productTitle">{previa.titulo}</h1> : <div className="skel skelTitulo" aria-hidden="true" />}
        <div className="skel skelPrecio" aria-hidden="true" />
        <div className="skel skelLinea" aria-hidden="true" />
        {previa && <p className="avisoVistaPrevia" role="status">{ui.producto.vistaPrevia}</p>}
        {previa && <button className="addCartBtn" disabled>{ui.producto.compraNoDisponible}</button>}
      </div>
    </div>
  )
}

export default function Producto({ locale = 'es' }) {
  const ui = t(locale)
  const [p, setP] = useState(null)
  const [cantidad, setCantidad] = useState(0) // 0 = todavía no le das "Agregar"
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [previa, setPrevia] = useState(null) // datos del catalogo guardado (sin red)
  const [enLinea, setEnLinea] = useState(true)

  useEffect(() => {
    setEnLinea(navigator.onLine)
    const si = () => setEnLinea(true)
    const no = () => setEnLinea(false)
    window.addEventListener('online', si)
    window.addEventListener('offline', no)
    return () => {
      window.removeEventListener('online', si)
      window.removeEventListener('offline', no)
    }
  }, [])

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
      .catch(async (e) => {
        if (!esSinRed(e)) return setError(e.message)
        // Sin red y sin ficha guardada: buscamos el disco en el catalogo del home (ya cacheado por el SW)
        try {
          const d = await gql(Q_CATALOGO)
          const encontrado = d.obtenerProductos.find((x) => String(x.id) === String(id))
          if (encontrado) setPrevia(encontrado)
          else setError(e.message)
        } catch {
          setError(e.message)
        }
      })
  }, [])

  // Vista previa sin red: al volver el internet se recarga con los datos completos
  useEffect(() => {
    if (!previa) return
    document.title = `${previa.titulo} | VINILO`.slice(0, 60)
    const volver = () => location.reload()
    window.addEventListener('online', volver)
    return () => window.removeEventListener('online', volver)
  }, [previa])

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
  if (previa) return <Skeleton previa={previa} ui={ui} />
  if (!p) return <Skeleton ui={ui} />

  const stock = Number(p.stock)
  const sinStock = stock <= 0

  return (
    <div className="productDetail">
      <div className="productImageContainer">
        <Img src={p.imagen_url} alt={ui.producto.portada(p.titulo, p.artista)} className="productImage" width={600} height={600} fetchPriority="high" />
        {p.spotify_uri && !enLinea ? <ReproductorNoDisponible ui={ui} /> : <SpotifyPlayer
          locale={locale}
          uri={p.spotify_uri}
          titulo={p.titulo}
          artista={p.artista}
          portada={urlImagen(p.imagen_url)}
          etiquetas={[p.categoria?.nombre, ui.producto.etiqueta].filter(Boolean)}
        />}
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