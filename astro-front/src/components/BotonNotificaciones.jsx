import { useState, useEffect } from 'react'
import { notificar } from '../lib/offline.js'
import { t, url } from '../i18n/index.js'

// Pide permiso para mostrar notificaciones (Notification API)
export default function BotonNotificaciones({ locale = 'es' }) {
  const ui = t(locale).notif
  const [permiso, setPermiso] = useState('cargando')

  useEffect(() => {
    setPermiso('Notification' in window ? Notification.permission : 'no-soportado')
  }, [])

  if (permiso === 'cargando' || permiso === 'no-soportado') return null
  if (permiso === 'granted') {
    return <p className="avisoNotif">{ui.activadas}</p>
  }
  if (permiso === 'denied') {
    return <p className="avisoNotif">{ui.bloqueadas}</p>
  }

  const pedir = async () => {
    const estado = await Notification.requestPermission()
    setPermiso(estado)
    if (estado === 'granted') {
      notificar(ui.bienvenidaTitulo, {
        body: ui.bienvenidaCuerpo,
        tag: 'bienvenida',
        data: { url: url(locale, '/mis-pedidos') },
      })
    }
  }

  return (
    <button type="button" className="botonNotif" onClick={pedir}>
      {ui.activar}
    </button>
  )
}