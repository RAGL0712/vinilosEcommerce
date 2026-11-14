import { IMAGEN_DEFECTO, urlImagen } from '../lib/api.js'

export default function Img({ src, alt = '', ...props }) {
  const alFallar = (e) => {
    const el = e.currentTarget
    if (el.getAttribute('src') !== IMAGEN_DEFECTO) el.src = IMAGEN_DEFECTO
  }
  return <img width="300" height="180" loading="lazy" decoding="async" {...props} alt={alt} src={urlImagen(src)} onError={alFallar} />
}
