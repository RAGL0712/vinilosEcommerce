import { IMAGEN_DEFECTO, urlImagen } from '../lib/api.js'

// <img> que usa la imagen por defecto si la url esta vacia o no carga
export default function Img({ src, alt = '', ...props }) {
  const alFallar = (e) => {
    const el = e.currentTarget
    if (el.getAttribute('src') !== IMAGEN_DEFECTO) el.src = IMAGEN_DEFECTO
  }
  return <img {...props} alt={alt} src={urlImagen(src)} onError={alFallar} />
}
