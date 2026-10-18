import { useState, useEffect } from 'react'
import { gql, guardarSesion, getSesion } from '../lib/api.js'

function IconoOjo({ abierto }) {
  return abierto ? (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function CampoPassword({ label, name, value, onChange }) {
  const [visible, setVisible] = useState(false)
  return (
    <div>
      <label>{label}</label>
      <div className="passwordWrap">
        <input
          type={visible ? 'text' : 'password'}
          name={name}
          required
          className="inputCO"
          value={value}
          onChange={onChange}
        />
        <button
          type="button"
          className="ojoBtn"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          <IconoOjo abierto={visible} />
        </button>
      </div>
    </div>
  )
}

// registro=false -> login, registro=true -> crear cuenta
export default function AuthForm({ registro = false }) {
  const [form, setForm] = useState({ nombre: '', email: '', password: '', confirmar: '' })
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    const s = getSesion()
    if (s) location.href = s.usuario.rol === 'ADMIN' ? '/admin' : '/'
  }, [])

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const noCoinciden = registro && form.confirmar !== '' && form.password !== form.confirmar

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    if (registro && form.password !== form.confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }
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

      <CampoPassword label="Contraseña" name="password" value={form.password} onChange={cambiar} />

      {registro && (
        <>
          <CampoPassword label="Confirmar contraseña" name="confirmar" value={form.confirmar} onChange={cambiar} />
          {noCoinciden && <p style={{ color: 'red', margin: 0 }}>Las contraseñas no coinciden</p>}
        </>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit" className="backBtn" disabled={cargando || noCoinciden}>
        {cargando ? 'Cargando...' : registro ? 'Registrarme' : 'Entrar'}
      </button>
      <a href={registro ? '/login' : '/registro'} className="backBtn" style={{ textAlign: 'center', textDecoration: 'none' }}>
        {registro ? 'Ya tengo cuenta' : 'Crear cuenta nueva'}
      </a>
    </form>
  )
}