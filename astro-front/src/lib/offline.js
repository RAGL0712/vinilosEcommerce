import { URL_API, getSesion, gqlAuth, marcarCarritoNuevo } from './api.js'

/* Cola de acciones hechas sin red (IndexedDB). El Service Worker la envia
   con Background Sync cuando vuelve la conexion. */
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

function enTransaccion(bd, accion) {
  return new Promise((ok, mal) => {
    const tx = bd.transaction(TABLA, 'readwrite')
    const resultado = accion(tx.objectStore(TABLA))
    tx.oncomplete = () => ok(resultado && resultado.result)
    tx.onerror = () => mal(tx.error)
  })
}

// Guarda la accion y agenda el envio para cuando vuelva la red
export async function guardarPendiente({ query, titulo }) {
  const bd = await abrirBD()
  await enTransaccion(bd, (t) =>
    t.add({ query, titulo, token: getSesion()?.accessToken || '', api: URL_API, creado: Date.now() })
  )
  await programarEnvio()
}

export async function programarEnvio() {
  if (!navigator.serviceWorker?.controller) return
  const reg = await navigator.serviceWorker.ready
  if ('sync' in reg) {
    try {
      await reg.sync.register('enviar-pendientes') // Background Sync (Chrome / Edge)
      return
    } catch {}
  }
  // Sin Background Sync (Firefox / Safari): EstadoRed lo envia al volver la red
}

// Respaldo desde la pagina: usa gqlAuth, que renueva el token si ya expiro
export async function enviarPendientesDesdePagina() {
  if (!('indexedDB' in window)) return
  const bd = await abrirBD()
  const lista = await new Promise((ok, mal) => {
    const tx = bd.transaction(TABLA, 'readwrite')
    const t = tx.objectStore(TABLA)
    const r = t.getAll()
    r.onsuccess = () => t.clear()
    tx.oncomplete = () => ok(r.result)
    tx.onerror = () => mal(tx.error)
  })
  const devolver = []
  for (const item of lista) {
    try {
      await gqlAuth(item.query)
      marcarCarritoNuevo()
      await notificar('Carrito actualizado', { body: `"${item.titulo}" ya está en tu carrito.`, tag: 'carrito', data: { url: '/carrito' } })
    } catch (e) {
      if (e instanceof TypeError || e.message.startsWith('Sin conexión')) devolver.push(item)
      else await notificar('No se pudo agregar', { body: `"${item.titulo}": ${e.message}`, tag: 'carrito-error', data: { url: '/carrito' } })
    }
  }
  if (devolver.length) await enTransaccion(bd, (t) => devolver.forEach((i) => t.put(i)))
}

// Muestra una notificacion a traves del Service Worker (Notification API)
export async function notificar(titulo, opciones = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  if (!navigator.serviceWorker?.controller) return
  const reg = await navigator.serviceWorker.ready
  return reg.showNotification(titulo, { icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', ...opciones })
}