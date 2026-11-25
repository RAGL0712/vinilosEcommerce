import Img from './Img.jsx'
import { t, url } from '../i18n/index.js'

export default function Tarjetas({ productos, locale = 'es' }) {
  const ui = t(locale)
  return (
    <div className="grid-productos">
      {productos.map((d) => (
        <a key={d.id} className="previewProduct" href={`${url(locale, '/producto')}?id=${d.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <Img src={d.imagen_url} alt={ui.producto.portadaTarjeta(d.titulo)} className="previewImage" width={300} height={180} loading="lazy" decoding="async" />
          <h2 className="tarjetaTitulo">{d.titulo}</h2>
          <p>{d.artista}</p>
          <span>${d.precio}</span>
        </a>
      ))}
    </div>
  )
}
