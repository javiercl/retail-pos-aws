import { useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const AUTH_STORAGE_KEY = 'authData'

function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${p}`
}

function getStoredAuth() {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function AppNavbar({ isAuthenticated, userName, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <header className="navbar">
      <h1 className="app-title">Retail POS App</h1>
      <nav className="navbar-actions">
        {!isAuthenticated ? (
          <>
            <button
              className={`nav-btn ${location.pathname === '/register' ? 'active' : ''}`}
              onClick={() => navigate('/register')}
            >
              Register
            </button>
            <button
              className={`nav-btn ${location.pathname === '/login' ? 'active' : ''}`}
              onClick={() => navigate('/login')}
            >
              Login
            </button>
          </>
        ) : (
          <div className="profile-box">
            <div className="avatar">{userName?.[0]?.toUpperCase() || 'U'}</div>
            <span>{userName || 'Usuario'}</span>
            <button className="logout-btn" onClick={onLogout}>
              Logout
            </button>
          </div>
        )}
      </nav>
    </header>
  )
}

function HomePage() {
  return (
    <section className="card">
      <h2>Home</h2>
      <p>Esta pagina es publica. Puedes registrarte o iniciar sesion desde el navbar.</p>
    </section>
  )
}

function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', name: '', password: '' })
  const [verificationCode, setVerificationCode] = useState('')
  const [pendingUsername, setPendingUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const canSubmit = useMemo(
    () => form.username.trim() && form.email.trim() && form.password.trim(),
    [form]
  )

  function handleChange(event) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    try {
      setLoading(true)
      setMessage('')
      setError('')
      const response = await fetch(apiUrl('/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || data?.error || 'Error al registrar')
      setPendingUsername(form.username)
      setMessage('Registro exitoso. Revisa tu email y escribe el codigo de verificacion para confirmar el usuario.')
      setForm((prev) => ({ ...prev, password: '' }))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm(event) {
    event.preventDefault()
    try {
      setConfirming(true)
      setError('')
      setMessage('')
      const response = await fetch(apiUrl('/auth/confirm'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: pendingUsername || form.username, code: verificationCode }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || data?.error || 'No se pudo confirmar usuario')
      setMessage('Usuario confirmado correctamente. Seras redirigido a login.')
      setVerificationCode('')
      setTimeout(() => navigate('/login'), 1200)
    } catch (err) {
      setError(err.message)
    } finally {
      setConfirming(false)
    }
  }

  return (
    <section className="card">
      <h2>Register</h2>
      <form className="form" onSubmit={handleSubmit}>
        <input name="username" placeholder="Username" value={form.username} onChange={handleChange} />
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} />
        <input name="name" placeholder="Nombre completo (opcional)" value={form.name} onChange={handleChange} />
        <input
          name="password"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
        />
        <button className="primary-btn" disabled={!canSubmit || loading}>
          {loading ? 'Registrando...' : 'Crear cuenta'}
        </button>
      </form>
      <form className="form confirm-form" onSubmit={handleConfirm}>
        <input
          value={pendingUsername || form.username}
          onChange={(event) => setPendingUsername(event.target.value)}
          placeholder="Username a confirmar"
        />
        <input
          value={verificationCode}
          onChange={(event) => setVerificationCode(event.target.value)}
          placeholder="Codigo de verificacion"
        />
        <button className="primary-btn" disabled={!verificationCode || !(pendingUsername || form.username) || confirming}>
          {confirming ? 'Confirmando...' : 'Confirmar usuario'}
        </button>
      </form>
      {message ? <p className="success">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  )
}

function LoginPage({ onLogin }) {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    try {
      setLoading(true)
      setError('')
      const response = await fetch(apiUrl('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || data?.error || 'Credenciales invalidas')
      if (!data.accessToken) throw new Error('No se recibio accessToken')

      const privateResponse = await fetch(apiUrl('/private'), {
        headers: { Authorization: `Bearer ${data.accessToken}` },
      })
      const privateData = await privateResponse.json().catch(() => ({}))
      if (!privateResponse.ok) throw new Error(privateData?.error || 'No se pudo validar el token')

      const auth = {
        accessToken: data.accessToken,
        idToken: data.idToken || '',
        username: privateData?.username || username,
      }
      onLogin(auth)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card">
      <h2>Login</h2>
      <form className="form" onSubmit={handleSubmit}>
        <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
        />
        <button className="primary-btn" disabled={!username || !password || loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
    </section>
  )
}

function DashboardPage({ userName }) {
  return (
    <section className="card">
      <h2>Dashboard Privado</h2>
      <p>Solo usuarios autenticados pueden ver esta pagina.</p>
      <p>
        Bienvenido, <strong>{userName}</strong>.
      </p>
    </section>
  )
}

function PrivateRoute({ isAuthenticated, children }) {
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const navigate = useNavigate()
  const [auth, setAuth] = useState(() => getStoredAuth())
  const isAuthenticated = Boolean(auth?.accessToken)

  function handleLogin(nextAuth) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth))
    setAuth(nextAuth)
  }

  function handleLogout() {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    setAuth(null)
    navigate('/')
  }

  return (
    <main className="app-shell">
      <AppNavbar
        isAuthenticated={isAuthenticated}
        userName={auth?.username}
        onLogout={handleLogout}
      />

      {!API_BASE ? <p className="warning">Configura VITE_API_URL en el archivo .env</p> : null}

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <DashboardPage userName={auth?.username || 'Usuario'} />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  )
}
