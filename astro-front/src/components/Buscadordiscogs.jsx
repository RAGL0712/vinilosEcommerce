import { useState } from 'react'
import { gqlAuth } from '../lib/api.js'
import Img from './Img.jsx'

const j = JSON.stringify

export default function BuscadorDiscogs({ onElegir, onManual }) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const buscar = async (e) => {
    e.preventDefault()
    if (texto.trim().length < 2) return
    setCargando(true)
    setError('')
    try {
      const d = await gqlAuth(`query { buscarDiscogs(texto: ${j(texto.trim())}) { id titulo artista anio generos imagen miniatura categoriaId categoriaNombre } }`)
      setResultados(d.buscarDiscogs)
    } catch (err) {
      setError(err.message)
      setResultados(null)
    }
    setCargando(false)
  }

  return (
    <div className="discogs">
      <form className="discogsBuscar" onSubmit={buscar}>
        <input className="inputCO" type="text" maxLength={150} placeholder="Album o artista (ej. Daft Punk Discovery)" value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus />
        <button className="backBtn adminBtn" type="submit" disabled={cargando}>{cargando ? 'Buscando...' : 'Buscar'}</button>
      </form>

      {error && <p className="discogsAviso">{error}</p>}
      {resultados && resultados.length === 0 && (
        <p className="discogsAviso">No encontramos ese album en Discogs. Puedes agregarlo manualmente.</p>
      )}

      {resultados && resultados.length > 0 && (
        <ul className="discogsLista">
          {resultados.map((r) => (
            <li key={r.id}>
              <button type="button" className="discogsItem" onClick={() => onElegir(r)}>
                <Img className="discogsMini" src={r.miniatura || ''} alt={r.titulo} />
                <span className="discogsTexto">
                  <strong>{r.titulo}</strong>
                  <span>{r.artista || 'Artista desconocido'}{r.anio ? ` · ${r.anio}` : ''}</span>
                  <small>Categoria: {r.categoriaNombre || 'OTRO'}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="backBtn adminBtn discogsManual" onClick={onManual}>Agregar manualmente</button>
      <p className="discogsCredito">Datos proporcionados por <a href="https://www.discogs.com" target="_blank" rel="noreferrer">Discogs</a></p>
    </div>
  )
}