import { useEffect, useMemo, useState } from 'react'

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const COGNITO_REGION = import.meta.env.VITE_COGNITO_REGION || 'us-east-1'
const COGNITO_CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || ''

function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${p}`
}

async function cognitoRequest(target, body) {
  const res = await fetch(`https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.message || 'Error Cognito')
  return data
}

export default function App() {
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [error, setError] = useState('')
  const [authMode, setAuthMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [idToken, setIdToken] = useState(localStorage.getItem('idToken') || '')

  const isAuth = Boolean(idToken)
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

  async function signUp() {
    try {
      setError('')
      await cognitoRequest('SignUp', {
        ClientId: COGNITO_CLIENT_ID,
        Username: username,
        Password: password,
        UserAttributes: [{ Name: 'email', Value: email }],
      })
      setAuthMode('confirm')
    } catch (err) {
      setError(err.message)
    }
  }

  async function confirmSignUp() {
    try {
      setError('')
      await cognitoRequest('ConfirmSignUp', {
        ClientId: COGNITO_CLIENT_ID,
        Username: username,
        ConfirmationCode: code,
      })
      setAuthMode('login')
    } catch (err) {
      setError(err.message)
    }
  }

  async function login() {
    try {
      setError('')
      const data = await cognitoRequest('InitiateAuth', {
        ClientId: COGNITO_CLIENT_ID,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: { USERNAME: username, PASSWORD: password },
      })
      const token = data?.AuthenticationResult?.IdToken
      if (!token) throw new Error('No se recibio idToken')
      localStorage.setItem('idToken', token)
      setIdToken(token)
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
          Authorization: `Bearer ${idToken}`,
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
    localStorage.removeItem('idToken')
    setIdToken('')
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
          {authMode === 'register' && (
            <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          )}
          {authMode === 'confirm' && (
            <input
              placeholder="Codigo confirmacion"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          )}
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            {authMode === 'login' && <button onClick={login}>Iniciar sesion</button>}
            {authMode === 'register' && <button onClick={signUp}>Registrarse</button>}
            {authMode === 'confirm' && <button onClick={confirmSignUp}>Confirmar cuenta</button>}
            <button onClick={() => setAuthMode('login')}>Modo login</button>
            <button onClick={() => setAuthMode('register')}>Modo registro</button>
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
