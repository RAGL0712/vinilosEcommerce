import { useState, useEffect } from 'react'
import { gql, guardarSesion, getSesion } from '../lib/api.js'

// registro=false -> login, registro=true -> crear cuenta
export default function AuthForm({ registro = false }) {
  const [form, setForm] = useState({ nombre: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    const s = getSesion()
    if (s) location.href = s.usuario.rol === 'ADMIN' ? '/admin' : '/'
  }, [])

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      if (registro) {
        await gql(`mutation { crearUsuario(datos: { nombre: "${form.nombre}", email: "${form.email}", password: "${form.password}" }) { id } }`)
      }
      const d = await gql(`mutation { login(datos: { email: "${form.email}", password: "${form.password}" }) { accessToken refreshToken usuario { id nombre email rol } } }`)
      guardarSesion(d.login)
      location.href = d.login.usuario.rol === 'ADMIN' ? '/admin' : '/'
    } catch (err) {
      setError(err.message)
      setCargando(false)
    }
  }

  return (
    <form className="logForm" onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px', margin: '3rem auto' }}>
      <h2>{registro ? 'Crear Cuenta' : 'Iniciar Sesion'}</h2>
      {registro && (
        <div><label>Nombre</label><input type="text" name="nombre" required className="inputCO" value={form.nombre} onChange={cambiar} /></div>
      )}
      <div><label>Correo Electronico</label><input type="email" name="email" required className="inputCO" value={form.email} onChange={cambiar} /></div>
      <div><label>Contraseña</label><input type="password" name="password" required className="inputCO" value={form.password} onChange={cambiar} /></div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit" className="backBtn" disabled={cargando}>
        {cargando ? 'Cargando...' : registro ? 'Registrarme' : 'Entrar'}
      </button>
      <a href={registro ? '/login' : '/registro'} className="backBtn" style={{ textAlign: 'center', textDecoration: 'none' }}>
        {registro ? 'Ya tengo cuenta' : 'Crear cuenta nueva'}
      </a>
    </form>
  )
}