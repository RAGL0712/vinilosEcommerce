export const URL_API = import.meta.env.DEV
  ? 'http://localhost:4000/'
  : 'https://vinilo-api.onrender.com/'
export function getSesion() {
  const g = localStorage.getItem('sesion')
  return g ? JSON.parse(g) : null
}
export function guardarSesion(s) {
  localStorage.setItem('sesion', JSON.stringify(s))
}

// Consulta GraphQL sin auth
export async function gql(query) {
  const res = await fetch(URL_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const r = await res.json()
  if (r.errors) throw new Error(r.errors[0].message)
  return r.data
}

let refrescando = null
async function refrescar() {
  const s = getSesion()
  try {
    const d = await gql(`mutation { refrescarToken(refreshToken: "${s.refreshToken}") { accessToken refreshToken usuario { id nombre email rol } } }`)
    guardarSesion(d.refrescarToken)
  } catch {
    localStorage.removeItem('sesion')
    location.href = '/login'
  }
}

// Consulta GraphQL con token (y refresh si expiró)
export async function gqlAuth(query) {
  const pedir = () => {
    const s = getSesion()
    const headers = { 'Content-Type': 'application/json' }
    if (s) headers.Authorization = 'Bearer ' + s.accessToken
    return fetch(URL_API, { method: 'POST', headers, body: JSON.stringify({ query }) })
  }
  let res = await pedir()
  const texto = await res.clone().text()
  if (texto.includes('TOKEN_EXPIRADO')) {
    if (!refrescando) refrescando = refrescar().finally(() => (refrescando = null))
    await refrescando
    res = await pedir()
  }
  const r = await res.json()
  if (r.errors) throw new Error(r.errors[0].message)
  return r.data
}

export async function cerrarSesion() {
  const s = getSesion()
  if (s) {
    try { await gql(`mutation { logout(refreshToken: "${s.refreshToken}") }`) } catch {}
  }
  localStorage.removeItem('sesion')
  location.href = '/login'
}

export async function obtenerCarrito() {
  const d = await gqlAuth(`query { obtenerCarrito { id producto_id titulo artista precio imagen_url cantidad } }`)
  return d.obtenerCarrito.map((i) => ({
    id: String(i.producto_id),
    title: i.titulo,
    artist: i.artista,
    price: Number(i.precio),
    cover: i.imagen_url,
    quantity: Number(i.cantidad),
  }))
}
