import { useState, useEffect } from 'react'
import { marcarCarritoNuevo } from '../lib/api.js'
import { enviarPendientesDesdePagina } from '../lib/offline.js'
import { t } from '../i18n/index.js'

// Aviso de "sin conexion" y reenvio de lo pendiente al volver la red
export default function EstadoRed({ locale = 'es' }) {
  const [enLinea, setEnLinea] = useState(true)

  useEffect(() => {
    setEnLinea(navigator.onLine)
    const conectado = () => {
      setEnLinea(true)
      navigator.serviceWorker?.controller?.postMessage('enviar-pendientes')
      enviarPendientesDesdePagina()
    }
    const desconectado = () => setEnLinea(false)
    const mensajeSW = (e) => {
      if (e.data?.tipo === 'carrito-actualizado') marcarCarritoNuevo()
    }

    window.addEventListener('online', conectado)
    window.addEventListener('offline', desconectado)
    navigator.serviceWorker?.addEventListener('message', mensajeSW)
    if (navigator.onLine) enviarPendientesDesdePagina() // por si quedo algo de antes

    return () => {
      window.removeEventListener('online', conectado)
      window.removeEventListener('offline', desconectado)
      navigator.serviceWorker?.removeEventListener('message', mensajeSW)
    }
  }, [])

  if (enLinea) return null
  return (
    <div className="avisoSinRed" role="status" aria-live="polite">
      {t(locale).sinRed}
    </div>
  )
}