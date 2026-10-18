import { useState, useEffect, useRef } from 'react'

// Carga el iFrame API de Spotify una sola vez para toda la pagina
let apiSpotify = null
function cargarSpotifyAPI() {
  if (apiSpotify) return apiSpotify
  apiSpotify = new Promise((resolve) => {
    window.onSpotifyIframeApiReady = (IFrameAPI) => resolve(IFrameAPI)
    const s = document.createElement('script')
    s.src = 'https://open.spotify.com/embed/iframe-api/v1'
    s.async = true
    document.body.appendChild(s)
  })
  return apiSpotify
}

const mmss = (ms) => {
  const s = Math.floor((ms || 0) / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const IconoAtras = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6 8.5 6V6l-8.5 6z" /></svg>
)
const IconoAdelante = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" /></svg>
)
const IconoPlay = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
)
const IconoPausa = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z" /></svg>
)

export default function SpotifyPlayer({ uri, titulo, artista, portada, etiquetas = [] }) {
  const contenedor = useRef(null)
  const controller = useRef(null)
  const [listo, setListo] = useState(false)
  const [estado, setEstado] = useState({ pausado: true, posicion: 0, duracion: 0 })

  useEffect(() => {
    if (!uri) return
    let cancelado = false
    setListo(false)
    setEstado({ pausado: true, posicion: 0, duracion: 0 })

    cargarSpotifyAPI().then((IFrameAPI) => {
      if (cancelado || !contenedor.current) return
      contenedor.current.innerHTML = ''
      const el = document.createElement('div')
      contenedor.current.appendChild(el)
      IFrameAPI.createController(el, { uri, width: '100%', height: 80 }, (c) => {
        if (cancelado) { c.destroy(); return }
        controller.current = c
        c.addListener('ready', () => setListo(true))
        c.addListener('playback_update', (e) =>
          setEstado({ pausado: e.data.isPaused, posicion: e.data.position, duracion: e.data.duration })
        )
      })
    })

    return () => {
      cancelado = true
      if (controller.current) controller.current.destroy()
      controller.current = null
    }
  }, [uri])

  if (!uri) return null

  const mover = (segundos) => {
    if (!controller.current) return
    const actual = estado.posicion / 1000
    const max = estado.duracion / 1000 || actual + segundos
    controller.current.seek(Math.min(Math.max(0, actual + segundos), max))
  }

  const saltarA = (e) => {
    if (!controller.current || !estado.duracion) return
    const r = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1)
    controller.current.seek((ratio * estado.duracion) / 1000)
  }

  const progreso = estado.duracion ? (estado.posicion / estado.duracion) * 100 : 0
  const reproduciendo = !estado.pausado

  return (
    <div className={`player ${reproduciendo ? 'reproduciendo' : ''}`}>
      <div className="head">
        <div className="back" style={{ backgroundImage: `url(${portada})` }} />
        <div className="front">
          <div className="avatar">
            <img src={portada} alt={titulo} />
          </div>
          <div className="infos">
            <span className="tituloCancion">{titulo}</span>
            <span className="artistaCancion">{artista}</span>
            <div className="tags">
              {etiquetas.map((t) => <span key={t}>{t}</span>)}
            </div>
          </div>
        </div>
      </div>

      <div className="timeline">
        <div className="controllers">
          <button type="button" onClick={() => mover(-10)} disabled={!listo} aria-label="Retroceder 10 segundos"><IconoAtras /></button>
          <button type="button" className="play" onClick={() => controller.current && controller.current.togglePlay()} disabled={!listo} aria-label={reproduciendo ? 'Pausar' : 'Reproducir'}>
            {reproduciendo ? <IconoPausa /> : <IconoPlay />}
          </button>
          <button type="button" onClick={() => mover(10)} disabled={!listo} aria-label="Adelantar 10 segundos"><IconoAdelante /></button>
        </div>
        <div className="soundline" onClick={saltarA}>
          <div style={{ width: `${progreso}%` }} />
        </div>
        <div className="tiempos">
          <span>{mmss(estado.posicion)}</span>
          <span>{listo ? mmss(estado.duracion) : 'Cargando...'}</span>
        </div>
      </div>

      <div className="embed" ref={contenedor} />
    </div>
  )
}