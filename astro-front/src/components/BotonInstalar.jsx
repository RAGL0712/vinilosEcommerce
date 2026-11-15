import { useState, useEffect } from 'react'

export default function BotonInstalar() {
  const [evento, setEvento] = useState(null)

  useEffect(() => {
    // Si ya se abre como app instalada, no mostramos el boton
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const alPoderInstalar = (e) => {
      e.preventDefault() // evita el aviso automatico de Chrome
      setEvento(e)       // lo guardamos para usarlo al dar clic
    }
    const alInstalar = () => setEvento(null)

    window.addEventListener('beforeinstallprompt', alPoderInstalar)
    window.addEventListener('appinstalled', alInstalar)
    return () => {
      window.removeEventListener('beforeinstallprompt', alPoderInstalar)
      window.removeEventListener('appinstalled', alInstalar)
    }
  }, [])

  if (!evento) return null

  const instalar = async () => {
    evento.prompt()
    await evento.userChoice // 'accepted' o 'dismissed'
    setEvento(null)         // el evento solo se puede usar una vez
  }

  return (
    <button type="button" className="botonInstalar" onClick={instalar}>
      Instalar app
    </button>
  )
}