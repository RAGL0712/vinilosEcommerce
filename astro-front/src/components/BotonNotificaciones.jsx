import { useState, useEffect } from 'react'
import { notificar } from '../lib/offline.js'

// Pide permiso para mostrar notificaciones (Notification API)
export default function BotonNotificaciones() {
  const [permiso, setPermiso] = useState('cargando')

  useEffect(() => {
    setPermiso('Notification' in window ? Notification.permission : 'no-soportado')
  }, [])

  if (permiso === 'cargando' || permiso === 'no-soportado') return null
  if (permiso === 'granted') {
    return <p className="avisoNotif">Notificaciones activadas: te avisaremos cuando cambie el estado de tu pedido.</p>
  }
  if (permiso === 'denied') {
    return <p className="avisoNotif">Bloqueaste las notificaciones. Puedes activarlas desde el candado de la barra de direcciones.</p>
  }

  const pedir = async () => {
    const estado = await Notification.requestPermission()
    setPermiso(estado)
    if (estado === 'granted') {
      notificar('Notificaciones activadas', {
        body: 'Te avisaremos cuando cambie el estado de tus pedidos.',
        tag: 'bienvenida',
        data: { url: '/mis-pedidos' },
      })
    }
  }

  return (
    <button type="button" className="botonNotif" onClick={pedir}>
      Activar notificaciones
    </button>
  )
}