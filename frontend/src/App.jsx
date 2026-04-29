import { useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const AUTH_STORAGE_KEY = 'authData'
const REQUEST_TIMEOUT_MS = 9000

function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${p}`
}

function getNetworkErrorMessage(error) {
  if (error?.name === 'AbortError') {
    return 'Tiempo de espera agotado. Verifica si el host o la base de datos estan activos.'
  }
  if (error instanceof TypeError) {
    return 'No se pudo conectar al backend. Verifica host, puerto y CORS.'
  }
  return error?.message || 'Error de conexion no esperado.'
}

async function fetchJson(path, options = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(apiUrl(path), {
      ...options,
      signal: controller.signal,
    })
    const data = await response.json().catch(() => ({}))
    return { response, data }
  } finally {
    clearTimeout(timeoutId)
  }
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
  const [menuOpen, setMenuOpen] = useState(false)

  function goTo(path) {
    navigate(path)
    setMenuOpen(false)
  }

  return (
    <header className="navbar">
      <div className="navbar-left">
        <h1 className="app-title">Retail POS App</h1>
        {isAuthenticated ? (
          <div className="menu-group">
            <button className="menu-trigger" onClick={() => setMenuOpen((prev) => !prev)}>
              Configuracion
            </button>
            {menuOpen ? (
              <div className="menu-dropdown">
                <button className="menu-item" onClick={() => goTo('/users')}>
                  Usuarios
                </button>
                <button className="menu-item" onClick={() => goTo('/products')}>
                  Productos
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
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
  const [showVerificationModal, setShowVerificationModal] = useState(false)
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
      const { response, data } = await fetchJson('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!response.ok) throw new Error(data?.message || data?.error || 'Error al registrar')
      setPendingUsername(form.username)
      setShowVerificationModal(true)
      setVerificationCode('')
      setMessage('Registro creado. Te enviamos un codigo al correo para confirmar la cuenta.')
      setForm((prev) => ({ ...prev, password: '' }))
    } catch (err) {
      setError(getNetworkErrorMessage(err))
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
      const { response, data } = await fetchJson('/auth/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: pendingUsername, code: verificationCode }),
      })
      if (!response.ok) throw new Error(data?.message || data?.error || 'No se pudo confirmar usuario')
      setShowVerificationModal(false)
      setMessage('Registro confirmado correctamente. Seras redirigido a login.')
      setForm({ username: '', email: '', name: '', password: '' })
      setPendingUsername('')
      setVerificationCode('')
      setTimeout(() => navigate('/login'), 1200)
    } catch (err) {
      setError(getNetworkErrorMessage(err))
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
      {message ? <p className="success">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {showVerificationModal ? (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Confirmar registro</h3>
            <p>Ingresa el codigo que recibiste por correo para terminar el registro.</p>
            <form className="form" onSubmit={handleConfirm}>
              <input value={pendingUsername} disabled />
              <input
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value)}
                placeholder="Codigo de verificacion"
              />
              <button className="primary-btn" disabled={!verificationCode || confirming}>
                {confirming ? 'Confirmando...' : 'Confirmar cuenta'}
              </button>
            </form>
          </div>
        </div>
      ) : null}
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
      const { response, data } = await fetchJson('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!response.ok) throw new Error(data?.message || data?.error || 'Credenciales invalidas')
      if (!data.accessToken) throw new Error('No se recibio accessToken')

      const { response: privateResponse, data: privateData } = await fetchJson('/private', {
        headers: { Authorization: `Bearer ${data.accessToken}` },
      })
      if (!privateResponse.ok) throw new Error(privateData?.error || 'No se pudo validar el token')

      const auth = {
        accessToken: data.accessToken,
        idToken: data.idToken || '',
        username: privateData?.username || username,
      }
      onLogin(auth)
      navigate('/dashboard')
    } catch (err) {
      setError(getNetworkErrorMessage(err))
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

function UsersPage({ token }) {
  const initialForm = {
    cognito_sub: '',
    username: '',
    email: '',
    full_name: '',
    password_hash: '',
    is_active: true,
  }

  const [users, setUsers] = useState([])
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadUsers() {
    try {
      setLoading(true)
      setError('')
      const { response, data } = await fetchJson('/users', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error(data?.message || data?.error || 'No se pudieron cargar usuarios')
      setUsers(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(getNetworkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  function handleChange(event) {
    const { name, value, type, checked } = event.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  function handleEdit(user) {
    setEditingId(user.id)
    setForm({
      cognito_sub: user.cognito_sub || '',
      username: user.username || '',
      email: user.email || '',
      full_name: user.full_name || '',
      password_hash: user.password_hash || '',
      is_active: Boolean(user.is_active),
    })
  }

  function resetForm() {
    setEditingId(null)
    setForm(initialForm)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    try {
      setError('')
      const payload = { ...form, cognito_sub: form.cognito_sub || null, full_name: form.full_name || null, password_hash: form.password_hash || null }
      const path = editingId ? `/users/${editingId}` : '/users'
      const method = editingId ? 'PUT' : 'POST'

      const { response, data } = await fetchJson(path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error(data?.message || data?.error || 'No se pudo guardar usuario')
      resetForm()
      await loadUsers()
    } catch (err) {
      setError(getNetworkErrorMessage(err))
    }
  }

  async function handleDelete(id) {
    if (!confirm('Deseas eliminar este usuario?')) return
    try {
      setError('')
      const { response, data } = await fetchJson(`/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error(data?.message || data?.error || 'No se pudo eliminar usuario')
      await loadUsers()
    } catch (err) {
      setError(getNetworkErrorMessage(err))
    }
  }

  return (
    <section className="card wide-card">
      <h2>Usuarios (CRUD)</h2>
      <form className="form grid-two" onSubmit={handleSubmit}>
        <input name="username" placeholder="Username" value={form.username} onChange={handleChange} required />
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required />
        <input name="full_name" placeholder="Nombre completo" value={form.full_name} onChange={handleChange} />
        <input name="cognito_sub" placeholder="Cognito sub (UUID)" value={form.cognito_sub} onChange={handleChange} />
        <input name="password_hash" placeholder="Password hash (opcional)" value={form.password_hash} onChange={handleChange} />
        <label className="check-row">
          <input name="is_active" type="checkbox" checked={form.is_active} onChange={handleChange} />
          Activo
        </label>
        <div className="actions-row">
          <button className="primary-btn">{editingId ? 'Actualizar' : 'Crear'}</button>
          {editingId ? (
            <button className="nav-btn" type="button" onClick={resetForm}>
              Cancelar
            </button>
          ) : null}
        </div>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p>Cargando...</p> : null}
      <div className="table-wrap">
        <table className="crud-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Email</th>
              <th>Nombre</th>
              <th>Activo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td>{user.full_name || '-'}</td>
                <td>{user.is_active ? 'Si' : 'No'}</td>
                <td>
                  <button className="nav-btn" onClick={() => handleEdit(user)}>
                    Editar
                  </button>
                  <button className="logout-btn" onClick={() => handleDelete(user.id)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ProductsPage({ token }) {
  const initialForm = { sku: '', name: '', description: '', price: '', stock: '', is_active: true }
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadProducts() {
    try {
      setLoading(true)
      setError('')
      const { response, data } = await fetchJson('/products', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error(data?.message || data?.error || 'No se pudieron cargar productos')
      setProducts(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(getNetworkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  function handleChange(event) {
    const { name, value, type, checked } = event.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  function handleEdit(product) {
    setEditingId(product.id)
    setForm({
      sku: product.sku || '',
      name: product.name || '',
      description: product.description || '',
      price: product.price ?? '',
      stock: product.stock ?? '',
      is_active: Boolean(product.is_active),
    })
  }

  function resetForm() {
    setEditingId(null)
    setForm(initialForm)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    try {
      setError('')
      const payload = {
        ...form,
        description: form.description || null,
        price: Number(form.price),
        stock: Number(form.stock),
      }

      const path = editingId ? `/products/${editingId}` : '/products'
      const method = editingId ? 'PUT' : 'POST'

      const { response, data } = await fetchJson(path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error(data?.message || data?.error || 'No se pudo guardar producto')
      resetForm()
      await loadProducts()
    } catch (err) {
      setError(getNetworkErrorMessage(err))
    }
  }

  async function handleDelete(id) {
    if (!confirm('Deseas eliminar este producto?')) return
    try {
      setError('')
      const { response, data } = await fetchJson(`/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error(data?.message || data?.error || 'No se pudo eliminar producto')
      await loadProducts()
    } catch (err) {
      setError(getNetworkErrorMessage(err))
    }
  }

  return (
    <section className="card wide-card">
      <h2>Productos (CRUD)</h2>
      <form className="form grid-two" onSubmit={handleSubmit}>
        <input name="sku" placeholder="SKU" value={form.sku} onChange={handleChange} required />
        <input name="name" placeholder="Nombre" value={form.name} onChange={handleChange} required />
        <input name="description" placeholder="Descripcion" value={form.description} onChange={handleChange} />
        <input name="price" type="number" step="0.01" min="0" placeholder="Precio" value={form.price} onChange={handleChange} required />
        <input name="stock" type="number" min="0" placeholder="Stock" value={form.stock} onChange={handleChange} required />
        <label className="check-row">
          <input name="is_active" type="checkbox" checked={form.is_active} onChange={handleChange} />
          Activo
        </label>
        <div className="actions-row">
          <button className="primary-btn">{editingId ? 'Actualizar' : 'Crear'}</button>
          {editingId ? (
            <button className="nav-btn" type="button" onClick={resetForm}>
              Cancelar
            </button>
          ) : null}
        </div>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p>Cargando...</p> : null}
      <div className="table-wrap">
        <table className="crud-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>SKU</th>
              <th>Nombre</th>
              <th>Precio</th>
              <th>Stock</th>
              <th>Activo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>{product.id}</td>
                <td>{product.sku}</td>
                <td>{product.name}</td>
                <td>{Number(product.price).toFixed(2)}</td>
                <td>{product.stock}</td>
                <td>{product.is_active ? 'Si' : 'No'}</td>
                <td>
                  <button className="nav-btn" onClick={() => handleEdit(product)}>
                    Editar
                  </button>
                  <button className="logout-btn" onClick={() => handleDelete(product.id)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
        <Route
          path="/users"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <UsersPage token={auth?.accessToken} />
            </PrivateRoute>
          }
        />
        <Route
          path="/products"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <ProductsPage token={auth?.accessToken} />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  )
}
