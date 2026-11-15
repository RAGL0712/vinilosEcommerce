import { useState, useEffect } from 'react'

export default function BotonInstalar() {
  const [evento, setEvento] = useState(null)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return // ya es la app instalada

    // Si el evento llego antes de que React cargara, ya esta guardado
    if (window.__eventoInstalar) setEvento(window.__eventoInstalar)

    const alPoderInstalar = () => setEvento(window.__eventoInstalar)
    const alInstalar = () => setEvento(null)
    window.addEventListener('vinilo-instalable', alPoderInstalar)
    window.addEventListener('vinilo-instalada', alInstalar)
    return () => {
      window.removeEventListener('vinilo-instalable', alPoderInstalar)
      window.removeEventListener('vinilo-instalada', alInstalar)
    }
  }, [])

  if (!evento) return null

  const instalar = async () => {
    evento.prompt()
    await evento.userChoice
    window.__eventoInstalar = null // solo se puede usar una vez
    setEvento(null)
  }

  return (
    <button type="button" className="botonInstalar" onClick={instalar}>
      Instalar app
    </button>
  )
}