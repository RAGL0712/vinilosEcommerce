import { useState, useEffect } from 'react'
import { t } from '../i18n/index.js'

const imgs = ['/heroImg1.webp', '/heroImg2.webp']

export default function Hero({ locale = 'es' }) {
  const [i, setI] = useState(0)

  useEffect(() => {
    // Respeta a quien pide menos movimiento: no cambia la imagen
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => setI((p) => (p + 1) % imgs.length), 3000)
    return () => clearInterval(timer)
  }, [])

  return <img src={imgs[i]} className="heroImg" alt={t(locale).hero.alt} width="1600" height="400" fetchPriority="high" decoding="async" />
}
