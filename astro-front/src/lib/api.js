export const URL_API = import.meta.env.DEV
  ? 'http://localhost:4000/'
  : 'https://vinilo-api.onrender.com/'
export function getSesion() {
  if (typeof localStorage === 'undefined') return null
  const g = localStorage.getItem('sesion')
  return g ? JSON.parse(g) : null
}
export function guardarSesion(s) {
  localStorage.setItem('sesion', JSON.stringify(s))
}

// Consulta GraphQL sin auth
export async function gql(query) {
  const res = await fetch(URL_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const r = await res.json()
  if (r.errors) throw new Error(r.errors[0].message)
  return r.data
}

let refrescando = null
async function refrescar() {
  const s = getSesion()
  try {
    const d = await gql(`mutation { refrescarToken(refreshToken: "${s.refreshToken}") { accessToken refreshToken usuario { id nombre email rol } } }`)
    guardarSesion(d.refrescarToken)
  } catch {
    localStorage.removeItem('sesion')
    location.href = '/login'
  }
}

// Consulta GraphQL con token (y refresh si expiró)
export async function gqlAuth(query) {
  const pedir = () => {
    const s = getSesion()
    const headers = { 'Content-Type': 'application/json' }
    if (s) headers.Authorization = 'Bearer ' + s.accessToken
    return fetch(URL_API, { method: 'POST', headers, body: JSON.stringify({ query }) })
  }
  let res = await pedir()
  const texto = await res.clone().text()
  if (texto.includes('TOKEN_EXPIRADO')) {
    if (!refrescando) refrescando = refrescar().finally(() => (refrescando = null))
    await refrescando
    res = await pedir()
  }
  const r = await res.json()
  if (r.errors) throw new Error(r.errors[0].message)
  return r.data
}

export async function cerrarSesion() {
  const s = getSesion()
  if (s) {
    try { await gql(`mutation { logout(refreshToken: "${s.refreshToken}") }`) } catch {}
  }
  localStorage.removeItem('carritoNuevo')
  localStorage.removeItem('sesion')
  location.href = '/login'
}

export async function obtenerCarrito() {
  const d = await gqlAuth(`query { obtenerCarrito { id producto_id titulo artista precio imagen_url cantidad } }`)
  return d.obtenerCarrito.map((i) => ({
    id: String(i.producto_id),
    title: i.titulo,
    artist: i.artista,
    price: Number(i.precio),
    cover: i.imagen_url,
    quantity: Number(i.cantidad),
  }))
}
// Avisa al Nav que se agregó algo al carrito 
export function marcarCarritoNuevo() {
  localStorage.setItem('carritoNuevo', '1')
  window.dispatchEvent(new Event('carrito-nuevo'))
}




// Suscripción GraphQL por WebSocket. Devuelve una función para cancelarla.
export function suscribir(query, onData, onError) {
  let ws
  let cerrado = false
  const abrir = () => {
    const s = getSesion()
    if (!s) return
    ws = new WebSocket(URL_API.replace(/^http/, 'ws'), 'graphql-transport-ws')
    ws.onopen = () =>
      ws.send(JSON.stringify({ type: 'connection_init', payload: { Authorization: 'Bearer ' + s.accessToken } }))
    ws.onmessage = async (e) => {
      const m = JSON.parse(e.data)
      if (m.type === 'connection_ack') {
        ws.send(JSON.stringify({ id: '1', type: 'subscribe', payload: { query } }))
      } else if (m.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }))
      } else if (m.type === 'next' && m.payload?.data) {
        onData(m.payload.data)
      } else if (e.data.includes('TOKEN_EXPIRADO')) {
        ws.onclose = null
        ws.close()
        await refrescar()
        if (!cerrado) abrir()
      } else if (m.type === 'error' || m.payload?.errors) {
        onError(JSON.stringify(m.payload))
      }
    }
    ws.onclose = () => { if (!cerrado) setTimeout(() => !cerrado && abrir(), 3000) }
  }
  abrir()
  return () => { cerrado = true; ws && ws.close() }
}

// ---------- Imagenes de productos ----------
export const IMAGEN_DEFECTO = 'https://t3.ftcdn.net/jpg/03/64/22/10/360_F_364221046_KJcZa8Yvt4WWFAuxfcCTTW7I2M9iTwLe.jpg'

// Las imagenes subidas se guardan como "/imagenes/ID" y viven en el backend
export function urlImagen(url) {
  if (!url || !String(url).trim()) return IMAGEN_DEFECTO
  return String(url).startsWith('/imagenes/') ? URL_API.replace(/\/$/, '') + url : url
}

// Comprueba que una url realmente carga como imagen (con limite de tiempo)
export function imagenCarga(url, ms = 8000) {
  return new Promise((resolve) => {
    const img = new Image()
    const t = setTimeout(() => resolve(false), ms)
    img.onload = () => { clearTimeout(t); resolve(img.naturalWidth > 0) }
    img.onerror = () => { clearTimeout(t); resolve(false) }
    img.src = url
  })
}

// Lee el archivo como imagen real, lo reduce (max 800px) y lo convierte a JPEG.
// Si el archivo no es una imagen valida lanza un error.
export async function comprimirImagen(archivo, maxLado = 800) {
  if (!archivo.type.startsWith('image/')) throw new Error('El archivo no es una imagen')
  let bmp
  try { bmp = await createImageBitmap(archivo) } catch { throw new Error('La imagen esta dañada o su formato no es valido') }
  const escala = Math.min(1, maxLado / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * escala)
  canvas.height = Math.round(bmp.height * escala)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
  if (!blob) throw new Error('No se pudo procesar la imagen')
  return blob
}

// Sube la imagen (solo admin). Devuelve la ruta "/imagenes/ID" para guardarla en imagen_url
export async function subirImagen(blob) {
  const pedir = () => {
    const s = getSesion()
    return fetch(URL_API + 'imagenes', {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'image/jpeg', Authorization: 'Bearer ' + (s ? s.accessToken : '') },
      body: blob,
    })
  }
  let res = await pedir()
  if (res.status === 401) {
    if (!refrescando) refrescando = refrescar().finally(() => (refrescando = null))
    await refrescando
    res = await pedir()
  }
  const r = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(r.error || 'No se pudo subir la imagen')
  return r.imagen_url
}
