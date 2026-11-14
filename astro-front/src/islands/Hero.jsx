import { useState, useEffect } from 'react'

const imgs = ['/heroImg1.webp', '/heroImg2.webp']

export default function Hero() {
  const [i, setI] = useState(0)

  useEffect(() => {
    // Respeta a quien pide menos movimiento: no cambia la imagen
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setI((p) => (p + 1) % imgs.length), 3000)
    return () => clearInterval(t)
  }, [])

  return <img src={imgs[i]} className="heroImg" alt="Discos de vinilo" width="1600" height="400" fetchPriority="high" decoding="async" />
}
