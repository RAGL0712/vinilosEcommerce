import { useState, useEffect } from 'react'
import { t } from '../i18n/index.js'

// Cada imagen en dos tamanos: el navegador elige la de 800 px en celular
const imgs = [
  { src: '/heroImg1.webp', srcSet: '/heroImg1-800.webp 800w, /heroImg1.webp 1200w' },
  { src: '/heroImg2.webp', srcSet: '/heroImg2-800.webp 800w, /heroImg2.webp 1600w' },
]

export default function Hero({ locale = 'es' }) {
  const [i, setI] = useState(0)

  useEffect(() => {
    // Respeta a quien pide menos movimiento: no cambia la imagen
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => setI((p) => (p + 1) % imgs.length), 3000)
    return () => clearInterval(timer)
  }, [])

  return (
    <img
      src={imgs[i].src}
      srcSet={imgs[i].srcSet}
      sizes="100vw"
      className="heroImg"
      alt={t(locale).hero.alt}
      width="1600"
      height="400"
      fetchPriority="high"
      decoding="async"
    />
  )
}