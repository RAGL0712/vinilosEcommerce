import { useState, useEffect } from 'react'
import { getSesion, gql, gqlAuth, suscribir } from '../lib/api.js'

const j = JSON.stringify
const ESTADOS = ['PENDIENTE', 'PAGADO', 'ENVIADO', 'CANCELADO']

function puedeCambiar(actual, nuevo) {
  if (actual === 'ENVIADO' || actual === 'CANCELADO') return false
  if (nuevo === 'CANCELADO') return true
  return ESTADOS.indexOf(nuevo) > ESTADOS.indexOf(actual)
}
function useEnVivo(query, clave) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => suscribir(query, (d) => setDatos(d[clave]), setError), [query, clave])
  return [datos, error]
}
async function accion(fn) {
  try { await fn(); return true } catch (e) { alert(e.message); return false }
}
function useSeleccion(lista) {
  const [sel, setSel] = useState(null)
  const actual = sel && sel.id && lista ? lista.find((x) => x.id === sel.id) : null
  useEffect(() => {
    if (lista && sel && sel.id && !actual) setSel(null)
  }, [lista])
  return [sel, setSel, actual]
}

function Panel({ titulo, onCerrar, children }) {
  return (
    <aside className="adminPanel">
      <div className="adminPanelTop">
        <h3>{titulo}</h3>
        <button className="cerrarBtn" onClick={onCerrar}>✕</button>
      </div>
      {children}
    </aside>
  )
}
const Q_USUARIOS = `subscription { usuariosEnVivo { id nombre email rol } }`
const VACIO_U = { id: '', nombre: '', email: '', password: '', rol: 'CLIENTE' }

function Usuarios() {
  const [lista, error] = useEnVivo(Q_USUARIOS, 'usuariosEnVivo')
  const [sel, setSel, u] = useSeleccion(lista)
  const [f, setF] = useState(VACIO_U)
  const cambiar = (e) => setF({ ...f, [e.target.name]: e.target.value })

  const nuevo = () => { setF(VACIO_U); setSel({ nuevo: true }) }
  const editar = () => { setF({ ...u, password: '' }); setSel({ id: u.id, editar: true }) }

  const guardar = async (e) => {
    e.preventDefault()
    const campos = `nombre: ${j(f.nombre)}, email: ${j(f.email)}, rol: ${f.rol}` + (f.password ? `, password: ${j(f.password)}` : '')
    const m = f.id
      ? `mutation { adminActualizarUsuario(id: ${j(f.id)}, datos: {${campos}}) { id } }`
      : `mutation { adminCrearUsuario(datos: {${campos}}) { id } }`
    if (await accion(() => gqlAuth(m))) setSel(f.id ? { id: f.id, editar: false } : null)
  }
  const eliminar = async () => {
    if (!confirm(`Eliminar a ${u.email}?`)) return
    if (await accion(() => gqlAuth(`mutation { adminEliminarUsuario(id: ${j(u.id)}) }`))) setSel(null)
  }

  const enForm = sel && (sel.nuevo || sel.editar)

  return (
    <div className={`adminLayout ${sel ? 'panelAbierto' : ''}`}>
      <section>
        <div className="adminHeader">
          <button className="backBtn adminBtn" onClick={nuevo}>+ Nuevo</button>
        </div>
        {error && <p>{error}</p>}
        {!lista ? <p>Cargando...</p> : (
          <table className="adminTabla">
            <thead><tr><th>ID</th><th>Nombre</th><th>Email</th><th>Rol</th></tr></thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.id} className={sel?.id === x.id ? 'filaActiva' : ''} onClick={() => setSel({ id: x.id, editar: false })}>
                  <td>{x.id}</td><td>{x.nombre}</td><td>{x.email}</td><td>{x.rol}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {sel && (enForm || u) && (
        <Panel titulo={sel.nuevo ? 'Nuevo usuario' : enForm ? 'Editar usuario' : u.nombre} onCerrar={() => setSel(null)}>
          {enForm ? (
            <form className="adminForm" onSubmit={guardar}>
              <label>Nombre<input className="inputCO" name="nombre" minLength={2} maxLength={100} value={f.nombre} onChange={cambiar} required /></label>
              <label>Email<input className="inputCO" name="email" type="email" maxLength={150} value={f.email} onChange={cambiar} required /></label>
              <label>Contraseña{f.id && ' (vacío = no cambiar)'}
                <input className="inputCO" name="password" type="password" minLength={6} maxLength={128} value={f.password} onChange={cambiar} required={!f.id} />
              </label>
              <label>Rol
                <select className="inputCO" name="rol" value={f.rol} onChange={cambiar}>
                  <option>CLIENTE</option>
                  <option>ADMIN</option>
                </select>
              </label>
              <div className="adminAcciones">
                <button className="backBtn adminBtn">Guardar</button>
                <button type="button" className="backBtn adminBtn" onClick={() => (f.id ? setSel({ id: f.id, editar: false }) : setSel(null))}>Cancelar</button>
              </div>
            </form>
          ) : (
            <>
              <p>Email: {u.email}</p>
              <p>Rol: {u.rol}</p>
              <div className="adminAcciones">
                <button className="backBtn adminBtn" onClick={editar}>Editar</button>
                <button className="backBtn adminBtn eliminarBtn" onClick={eliminar}>Eliminar</button>
              </div>
            </>
          )}
        </Panel>
      )}
    </div>
  )
}
const Q_PRODUCTOS = `subscription { productosEnVivo { id titulo artista precio stock imagen_url categoria { id nombre } } }`
const VACIO_P = { id: '', titulo: '', artista: '', precio: '', stock: '', imagen_url: '', categoriaId: '' }

function Productos() {
  const [lista, error] = useEnVivo(Q_PRODUCTOS, 'productosEnVivo')
  const [sel, setSel, p] = useSeleccion(lista)
  const [categorias, setCategorias] = useState([])
  const [f, setF] = useState(VACIO_P)
  const cambiar = (e) => setF({ ...f, [e.target.name]: e.target.value })

  useEffect(() => {
    gql('query { obtenerCategorias { id nombre } }').then((d) => setCategorias(d.obtenerCategorias))
  }, [])

  const nuevo = () => { setF(VACIO_P); setSel({ nuevo: true }) }
  const editar = () => {
    setF({ id: p.id, titulo: p.titulo, artista: p.artista, precio: p.precio, stock: p.stock, imagen_url: p.imagen_url || '', categoriaId: p.categoria.id })
    setSel({ id: p.id, editar: true })
  }

  const guardar = async (e) => {
    e.preventDefault()
    const campos = `titulo: ${j(f.titulo)}, artista: ${j(f.artista)}, precio: ${Number(f.precio)}, stock: ${parseInt(f.stock)}, categoriaId: ${j(f.categoriaId)}, imagen_url: ${j(f.imagen_url)}`
    const m = f.id
      ? `mutation { actualizarProducto(id: ${j(f.id)}, datos: {${campos}}) { id } }`
      : `mutation { crearProducto(datos: {${campos}}) { id } }`
    if (await accion(() => gqlAuth(m))) setSel(f.id ? { id: f.id, editar: false } : null)
  }
  const eliminar = async () => {
    if (!confirm(`Eliminar "${p.titulo}"?`)) return
    if (await accion(() => gqlAuth(`mutation { eliminarProducto(id: ${j(p.id)}) }`))) setSel(null)
  }

  const enForm = sel && (sel.nuevo || sel.editar)

  return (
    <div className={`adminLayout ${sel ? 'panelAbierto' : ''}`}>
      <section>
        <div className="adminHeader">
          <button className="backBtn adminBtn" onClick={nuevo}>+ Nuevo</button>
        </div>
        {error && <p>{error}</p>}
        {!lista ? <p>Cargando...</p> : (
          <table className="adminTabla">
            <thead><tr><th>ID</th><th>Titulo</th><th>Artista</th><th>Precio</th><th>Stock</th><th>Categoria</th></tr></thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.id} className={sel?.id === x.id ? 'filaActiva' : ''} onClick={() => setSel({ id: x.id, editar: false })}>
                  <td>{x.id}</td><td>{x.titulo}</td><td>{x.artista}</td><td>${x.precio}</td><td>{x.stock}</td><td>{x.categoria.nombre}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {sel && (enForm || p) && (
        <Panel titulo={sel.nuevo ? 'Nuevo producto' : enForm ? 'Editar producto' : p.titulo} onCerrar={() => setSel(null)}>
          {enForm ? (
            <form className="adminForm" onSubmit={guardar}>
              <label>Titulo<input className="inputCO" name="titulo" maxLength={150} value={f.titulo} onChange={cambiar} required /></label>
              <label>Artista<input className="inputCO" name="artista" maxLength={150} value={f.artista} onChange={cambiar} required /></label>
              <label>Precio<input className="inputCO" name="precio" type="number" step="0.01" min="0.01" max="99999999.99" value={f.precio} onChange={cambiar} required /></label>
              <label>Stock<input className="inputCO" name="stock" type="number" step="1" min={f.id ? 0 : 1} max="100000" value={f.stock} onChange={cambiar} required /></label>
              <label>URL imagen<input className="inputCO" name="imagen_url" type="url" maxLength={255} placeholder="https://..." value={f.imagen_url} onChange={cambiar} /></label>
              <label>Categoria
                <select className="inputCO" name="categoriaId" value={f.categoriaId} onChange={cambiar} required>
                  <option value="">Selecciona...</option>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </label>
              <div className="adminAcciones">
                <button className="backBtn adminBtn">Guardar</button>
                <button type="button" className="backBtn adminBtn" onClick={() => (f.id ? setSel({ id: f.id, editar: false }) : setSel(null))}>Cancelar</button>
              </div>
            </form>
          ) : (
            <>
              {p.imagen_url && <img className="adminImagen" src={p.imagen_url} alt={p.titulo} />}
              <p>Artista: {p.artista}</p>
              <p>Categoria: {p.categoria.nombre}</p>
              <p>Precio: ${p.precio}</p>
              <p>Stock: {p.stock}</p>
              <div className="adminAcciones">
                <button className="backBtn adminBtn" onClick={editar}>Editar</button>
                <button className="backBtn adminBtn eliminarBtn" onClick={eliminar}>Eliminar</button>
              </div>
            </>
          )}
        </Panel>
      )}
    </div>
  )
}
const Q_PEDIDOS = `subscription { pedidosEnVivo { id nombreCliente email direccion fecha status total lineas { cantidad precioUnitario producto { titulo } } } }`

function Pedidos() {
  const [lista, error] = useEnVivo(Q_PEDIDOS, 'pedidosEnVivo')
  const [sel, setSel, p] = useSeleccion(lista)

  const cambiarEstado = async (status) => {
    if (!confirm(`Cambiar el pedido #${p.id} a ${status}?`)) return
    await accion(() => gqlAuth(`mutation { adminCambiarEstadoPedido(id: ${j(p.id)}, status: ${status}) { id } }`))
  }

  return (
    <div className={`adminLayout ${sel ? 'panelAbierto' : ''}`}>
      <section>
        {error && <p>{error}</p>}
        {!lista ? <p>Cargando...</p> : (
          <table className="adminTabla">
            <thead><tr><th>ID</th><th>Cliente</th><th>Fecha</th><th>Estado</th><th>Total</th></tr></thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.id} className={sel?.id === x.id ? 'filaActiva' : ''} onClick={() => setSel({ id: x.id })}>
                  <td>{x.id}</td><td>{x.nombreCliente}</td><td>{new Date(x.fecha).toLocaleDateString()}</td>
                  <td>{x.status}</td><td>${x.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {sel && p && (
        <Panel titulo={`Pedido #${p.id}`} onCerrar={() => setSel(null)}>
          <p>Cliente: {p.nombreCliente}</p>
          <p>Email: {p.email}</p>
          <p>Direccion: {p.direccion}</p>
          <p>Fecha: {new Date(p.fecha).toLocaleString()}</p>
          <p>Estado: {p.status}</p>
          <p>Total: ${p.total}</p>
          <div className="adminEstados">
            {ESTADOS.map((e) => (
              <button
                key={e}
                className={`backBtn adminBtn ${p.status === e ? 'tabActivo' : ''}`}
                disabled={!puedeCambiar(p.status, e)}
                onClick={() => cambiarEstado(e)}
              >
                {e}
              </button>
            ))}
          </div>
          <p>Productos:</p>
          <ul className="adminLineas">
            {p.lineas.map((l, i) => (
              <li key={i}>{l.producto.titulo} ({l.cantidad}) {l.precioUnitario}$</li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
export default function Backoffice() {
  const [tab, setTab] = useState('usuarios')
  const [ok, setOk] = useState(false)

  useEffect(() => {
    const s = getSesion()
    if (!s) { location.href = '/login'; return }
    if (s.usuario.rol !== 'ADMIN') { location.href = '/'; return }
    setOk(true)
  }, [])

  if (!ok) return null
  const t = (id, texto) => (
    <button className={`backBtn adminBtn ${tab === id ? 'tabActivo' : ''}`} onClick={() => setTab(id)}>{texto}</button>
  )
  return (
    <main className="adminMain">
      <h1>Backoffice</h1>
      <nav className="adminTabs">
        {t('usuarios', 'Usuarios')}
        {t('productos', 'Productos')}
        {t('pedidos', 'Pedidos')}
      </nav>
      {tab === 'usuarios' && <Usuarios />}
      {tab === 'productos' && <Productos />}
      {tab === 'pedidos' && <Pedidos />}
    </main>
  )
}