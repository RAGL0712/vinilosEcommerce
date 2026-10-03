import { useState, useEffect } from 'react'

const imgs = ['/heroImg1.webp', '/heroImg2.webp']

export default function Hero() {
  const [i, setI] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % imgs.length), 3000)
    return () => clearInterval(t)
  }, [])

  return <img src={imgs[i]} className="heroImg" alt="" />
}
