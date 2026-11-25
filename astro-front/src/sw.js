/* ===== Service Worker de VINILO =====
   Proxy entre la tienda y la red: decide si cada peticion se responde
   desde la red, desde el cache o con una mezcla de ambos. */

// Lista del build (HTML, CSS, JS, iconos). @vite-pwa/astro la escribe aqui al compilar.
const ARCHIVOS_BUILD = self.__WB_MANIFEST

// Version automatica: cambia en cada build porque cambian los archivos
const VERSION = huellaCorta(JSON.stringify(ARCHIVOS_BUILD))
const CACHE_SHELL = `vinilo-shell-${VERSION}`     // precache del shell
const CACHE_PAGINAS = `vinilo-paginas-${VERSION}` // paginas visitadas (network-first)
const CACHE_ASSETS = 'vinilo-assets'              // imagenes y fuentes (cache-first)
const CACHE_DATOS = 'vinilo-datos'                // catalogo y fichas (network-first)
const CACHES_VIGENTES = [CACHE_SHELL, CACHE_PAGINAS, CACHE_ASSETS, CACHE_DATOS]

const APIS = ['https://vinilo-api.onrender.com', 'http://localhost:4000']
const OFFLINE = '/offline.html'

/* Textos del SW por idioma (el SW no usa la interfaz, tiene su propio mini diccionario) */
const TXT = {
  es: {
    carritoTitulo: 'Carrito actualizado',
    carritoCuerpo: (t) => `"${t}" ya está en tu carrito.`,
    errorTitulo: 'No se pudo agregar',
    accionSinRed: 'Sin conexión: esta acción necesita internet.',
    datosSinGuardar: 'Sin conexión: esta información todavía no está guardada. Ábrela una vez con internet para poder verla sin conexión.',
    imagenNoGuardada: 'Imagen no guardada',
    sinConexion: 'Sin conexión',
  },
  en: {
    carritoTitulo: 'Cart updated',
    carritoCuerpo: (t) => `"${t}" is now in your cart.`,
    errorTitulo: "Couldn't add it",
    accionSinRed: "You're offline: this action needs internet.",
    datosSinGuardar: "You're offline: this information isn't saved yet. Open it once with internet to see it offline.",
    imagenNoGuardada: 'Image not saved',
    sinConexion: 'Offline',
  },
}
// Idioma de la pagina que hizo la peticion (/en/... -> 'en')
const idiomaDe = (req) => {
  try { return new URL(req.referrer || req.url).pathname.startsWith('/en') ? 'en' : 'es' } catch { return 'es' }
}
// '/carrito' -> '/en/carrito' si el idioma es ingles (el espanol no lleva prefijo)
const rutaIdioma = (idioma, ruta) => (idioma === 'en' ? '/en' + (ruta === '/' ? '/' : ruta) : ruta)
const MAX_ASSETS = 150

// 'index.html' -> '/', 'producto/index.html' -> '/producto/'
function aRuta(url) {
  const r = '/' + url.replace(/^\//, '')
  return r.endsWith('index.html') ? r.slice(0, -'index.html'.length) : r
}
const SHELL = [...new Set(ARCHIVOS_BUILD.map((a) => aRuta(a.url)).concat(OFFLINE))]

/* ---------- 1. INSTALL: precache del shell ---------- */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_SHELL)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()) // el SW nuevo no espera a que cierren las pestanas
  )
})

/* ---------- 2. ACTIVATE: borrar caches viejas ---------- */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(
        nombres.filter((n) => !CACHES_VIGENTES.includes(n)).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim()) // toma el control de las pestanas ya abiertas
  )
})

/* ---------- 3. FETCH: estrategia segun el tipo de peticion ---------- */
self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)

  // Catalogo y ficha (GraphQL por POST) -> network-first
  if (req.method === 'POST' && APIS.includes(url.origin)) {
    e.respondWith(datosNetworkFirst(req))
    return
  }
  if (req.method !== 'GET') return

  // Paginas HTML -> network-first, con offline.html de respaldo
  if (req.mode === 'navigate') {
    e.respondWith(paginaNetworkFirst(req))
    return
  }

  // Archivos del shell (JS, CSS, iconos) -> cache-first
  if (url.origin === location.origin && SHELL.includes(url.pathname)) {
    e.respondWith(cacheFirst(req, CACHE_SHELL))
    return
  }

  // Imagenes (portadas) y fuentes -> cache-first
  const esFuente = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  const esAssetPropio = url.origin === location.origin && ['style', 'script', 'font'].includes(req.destination)
  if (req.destination === 'image' || esFuente || esAssetPropio) {
    e.respondWith(cacheFirst(req, CACHE_ASSETS))
  }
  // Lo demas (Mercado Pago, Spotify...) va directo a la red
})

/* ---------- Estrategias ---------- */

// Cache-first: si esta guardado no toca la red
async function cacheFirst(req, nombreCache) {
  const guardada = await caches.match(req, { ignoreVary: true })
  if (guardada) return guardada
  try {
    const res = await fetch(req)
    if (res.ok || res.type === 'opaque') {
      const cache = await caches.open(nombreCache)
      await cache.put(req, res.clone())
      if (nombreCache === CACHE_ASSETS) recortar(cache, MAX_ASSETS)
    }
    return res
  } catch {
    if (req.destination === 'image') return imagenSinRed(idiomaDe(req))
    return Response.error()
  }
}

// Network-first para paginas: red; si falla, la copia guardada; si no hay, offline.html
async function paginaNetworkFirst(req) {
  const clave = claveDePagina(req.url)
  try {
    const res = await fetch(req)
    if (res.ok && res.type === 'basic') {
      const cache = await caches.open(CACHE_PAGINAS)
      await cache.put(clave, res.clone())
    }
    return res
  } catch {
    const guardada = (await caches.match(clave)) || (await caches.match(OFFLINE))
    return guardada ? sinRedireccion(guardada) : Response.error()
  }
}

// Network-first para el catalogo (GraphQL). Solo se guardan consultas publicas
// (sin token): los datos de cada usuario (carrito, pedidos) nunca se guardan.
async function datosNetworkFirst(req) {
  const cuerpo = await req.clone().text()
  let consulta = ''
  try { consulta = JSON.parse(cuerpo).query || '' } catch {}
  const esLectura = !/^\s*(mutation|subscription)\b/.test(consulta)
  const esPublica = !req.headers.has('Authorization')

  if (!esLectura || !esPublica) {
    try { return await fetch(req) } catch {
      return respuestaSinRed(TXT[idiomaDe(req)].accionSinRed)
    }
  }

  const clave = new Request(`${location.origin}/__datos/${await huella(cuerpo)}`)
  try {
    const res = await fetch(req)
    const texto = await res.clone().text()
    if (res.ok && !texto.includes('"errors"')) {
      const cache = await caches.open(CACHE_DATOS)
      await cache.put(clave, new Response(texto, { headers: { 'Content-Type': 'application/json' } }))
    }
    return res
  } catch {
    return (await caches.match(clave)) || respuestaSinRed(TXT[idiomaDe(req)].datosSinGuardar)
  }
}

/* ---------- 4. BACKGROUND SYNC: reenviar lo que se hizo sin red ---------- */
self.addEventListener('sync', (e) => {
  if (e.tag === 'enviar-pendientes') e.waitUntil(enviarPendientes())
})

// Respaldo para navegadores sin Background Sync: la pagina avisa al volver la red
self.addEventListener('message', (e) => {
  if (e.data === 'enviar-pendientes') e.waitUntil(enviarPendientes())
})

async function enviarPendientes() {
  const lista = await tomarPendientes()
  const devolver = []
  let faltoRed = false

  for (const item of lista) {
    const idioma = item.idioma === 'en' ? 'en' : 'es' // idioma en que se guardo el pendiente
    const tx = TXT[idioma]
    try {
      const res = await fetch(item.api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + item.token },
        body: JSON.stringify({ query: item.query }),
      })
      const r = await res.json()
      if (!r.errors) {
        await avisar(tx.carritoTitulo, tx.carritoCuerpo(item.titulo), rutaIdioma(idioma, '/carrito'), 'carrito')
        await avisarPestanas({ tipo: 'carrito-actualizado' })
      } else if (r.errors[0].message.includes('TOKEN_EXPIRADO')) {
        devolver.push(item) // la pagina lo enviara con una sesion nueva
      } else {
        await avisar(tx.errorTitulo, `"${item.titulo}": ${r.errors[0].message}`, rutaIdioma(idioma, '/carrito'), 'carrito-error')
      }
    } catch {
      faltoRed = true
      devolver.push(item)
    }
  }
  await devolverPendientes(devolver)
  if (faltoRed) throw new Error('Sin red: el navegador volverá a intentar')
}

/* ---------- 5. NOTIFICACIONES ---------- */
async function avisar(titulo, cuerpo, url, tag) {
  if (self.Notification && self.Notification.permission !== 'granted') return
  try {
    await self.registration.showNotification(titulo, {
      body: cuerpo, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag, data: { url },
    })
  } catch {}
}

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => new URL(v.url).pathname.replace(/\/$/, '') === url.replace(/\/$/, ''))
      return abierta ? abierta.focus() : self.clients.openWindow(url)
    })
  )
})

async function avisarPestanas(mensaje) {
  const ventanas = await self.clients.matchAll({ type: 'window' })
  ventanas.forEach((v) => v.postMessage(mensaje))
}

/* ---------- Utilidades ---------- */

// La ficha es la misma pagina para todos los discos: '/producto?id=2' -> '/producto/'
function claveDePagina(href) {
  const u = new URL(href)
  let ruta = u.pathname
  if (!ruta.endsWith('/') && !ruta.includes('.')) ruta += '/'
  return new Request(u.origin + ruta)
}

// Una respuesta que vino de una redireccion no se puede usar para navegar
async function sinRedireccion(res) {
  if (!res.redirected) return res
  const cuerpo = await res.blob()
  return new Response(cuerpo, { headers: res.headers, status: res.status, statusText: res.statusText })
}

function respuestaSinRed(mensaje) {
  return new Response(JSON.stringify({ data: null, errors: [{ message: mensaje }] }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
}

function imagenSinRed(idioma = 'es') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
<rect width="300" height="300" fill="#eeeeee"/>
<text x="150" y="145" font-family="Arial" font-size="18" text-anchor="middle" fill="#555555">${TXT[idioma].imagenNoGuardada}</text>
<text x="150" y="172" font-family="Arial" font-size="14" text-anchor="middle" fill="#777777">${TXT[idioma].sinConexion}</text></svg>`
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } })
}

async function recortar(cache, maximo) {
  const claves = await cache.keys()
  for (let i = 0; i < claves.length - maximo; i++) await cache.delete(claves[i])
}

async function huella(texto) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function huellaCorta(texto) {
  let h = 5381
  for (let i = 0; i < texto.length; i++) h = (h * 33) ^ texto.charCodeAt(i)
  return (h >>> 0).toString(36)
}

/* ---------- Cola de pendientes (IndexedDB) ---------- */
const BD = 'vinilo-offline'
const TABLA = 'pendientes'

function abrirBD() {
  return new Promise((ok, mal) => {
    const r = indexedDB.open(BD, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(TABLA, { keyPath: 'id', autoIncrement: true })
    r.onsuccess = () => ok(r.result)
    r.onerror = () => mal(r.error)
  })
}

// Saca todos los pendientes de una vez (asi la pagina y el SW nunca envian el mismo dos veces)
async function tomarPendientes() {
  const bd = await abrirBD()
  return new Promise((ok, mal) => {
    const tx = bd.transaction(TABLA, 'readwrite')
    const tabla = tx.objectStore(TABLA)
    const r = tabla.getAll()
    r.onsuccess = () => tabla.clear()
    tx.oncomplete = () => ok(r.result)
    tx.onerror = () => mal(tx.error)
  })
}

async function devolverPendientes(lista) {
  if (!lista.length) return
  const bd = await abrirBD()
  await new Promise((ok, mal) => {
    const tx = bd.transaction(TABLA, 'readwrite')
    lista.forEach((item) => tx.objectStore(TABLA).put(item))
    tx.oncomplete = ok
    tx.onerror = () => mal(tx.error)
  })
}