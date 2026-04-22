import { useEffect, useMemo, useState } from 'react'

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const TOKEN_KEY = 'accessToken'

function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${p}`
}

export default function App() {
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [error, setError] = useState('')
  const [authMode, setAuthMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || '')

  const isAuth = Boolean(token)
  const total = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0),
    [cart]
  )

  useEffect(() => {
    if (!API_BASE) return
    fetch(apiUrl('/products'))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('No se pudo cargar catalogo'))))
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message))
  }, [])

  function addToCart(product) {
    setCart((prev) => {
      const found = prev.find((p) => p.id === product.id)
      if (!found) return [...prev, { ...product, qty: 1 }]
      return prev.map((p) => (p.id === product.id ? { ...p, qty: p.qty + 1 } : p))
    })
  }

  async function register() {
    try {
      setError('')
      const res = await fetch(apiUrl('/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'No se pudo registrar')
      localStorage.setItem(TOKEN_KEY, data.token)
      setToken(data.token)
    } catch (err) {
      setError(err.message)
    }
  }

  async function login() {
    try {
      setError('')
      const res = await fetch(apiUrl('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Credenciales invalidas')
      if (!data.token) throw new Error('No se recibio token')
      localStorage.setItem(TOKEN_KEY, data.token)
      setToken(data.token)
    } catch (err) {
      setError(err.message)
    }
  }

  async function checkout() {
    try {
      setError('')
      const res = await fetch(apiUrl('/sales'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ items: cart }),
      })
      if (!res.ok) throw new Error('No se pudo registrar la venta')
      setCart([])
      alert('Venta registrada correctamente')
    } catch (err) {
      setError(err.message)
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken('')
  }

  return (
    <main style={{ maxWidth: 900, margin: '24px auto', fontFamily: 'Arial, sans-serif' }}>
      <h1>Retail POS</h1>
      {!API_BASE && <p>Configura VITE_API_URL en .env</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {!isAuth ? (
        <section>
          <h2>Autenticacion</h2>
          <input placeholder="Usuario" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            {authMode === 'login' && <button onClick={login}>Iniciar sesion</button>}
            {authMode === 'register' && <button onClick={register}>Registrarse</button>}
            <button type="button" onClick={() => setAuthMode('login')}>
              Modo login
            </button>
            <button type="button" onClick={() => setAuthMode('register')}>
              Modo registro
            </button>
          </div>
        </section>
      ) : (
        <section>
          <p>Sesion activa con JWT</p>
          <button onClick={logout}>Cerrar sesion</button>
        </section>
      )}

      <section>
        <h2>Productos</h2>
        <ul>
          {products.map((p) => (
            <li key={p.id}>
              {p.name} - ${p.price}
              <button onClick={() => addToCart(p)} style={{ marginLeft: 8 }}>
                Agregar
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Carrito</h2>
        <ul>
          {cart.map((item) => (
            <li key={item.id}>
              {item.name} x {item.qty} = ${Number(item.price) * Number(item.qty)}
            </li>
          ))}
        </ul>
        <p>Total: ${total.toFixed(2)}</p>
        <button disabled={!isAuth || cart.length === 0} onClick={checkout}>
          Confirmar venta
        </button>
      </section>
    </main>
  )
}
