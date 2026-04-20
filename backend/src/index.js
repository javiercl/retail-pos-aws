import 'dotenv/config'
import express from 'express'
import { authMiddleware } from './auth.js'
import { ensureSchema, pool } from './db.js'

const app = express()
app.use(express.json())

app.get('/health', (_req, res) => res.json({ ok: true }))

app.get('/products', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, price::float AS price, stock FROM products ORDER BY id'
  )
  res.json(rows)
})

app.post('/products', authMiddleware, async (req, res) => {
  const { name, price, stock = 0 } = req.body || {}
  if (!name || Number(price) <= 0) {
    return res.status(400).json({ error: 'name y price son requeridos' })
  }

  const { rows } = await pool.query(
    'INSERT INTO products (name, price, stock) VALUES ($1, $2, $3) RETURNING id, name, price::float AS price, stock',
    [name, Number(price), Number(stock)]
  )
  res.status(201).json(rows[0])
})

app.post('/sales', authMiddleware, async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : []
  if (items.length === 0) {
    return res.status(400).json({ error: 'items es requerido' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const total = items.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.qty),
      0
    )
    const username = req.user?.['cognito:username'] || req.user?.email || req.user?.sub

    const sale = await client.query(
      'INSERT INTO sales (username, total) VALUES ($1, $2) RETURNING id, username, total::float AS total, created_at',
      [username, total]
    )

    for (const item of items) {
      await client.query(
        'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)',
        [sale.rows[0].id, Number(item.id), Number(item.qty), Number(item.price)]
      )
    }

    await client.query('COMMIT')
    res.status(201).json(sale.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: err.message || 'Error registrando venta' })
  } finally {
    client.release()
  }
})

const port = Number(process.env.PORT || 8080)

async function boot() {
  await ensureSchema()
  app.listen(port, () => console.log(`Backend POS escuchando en ${port}`))
}

boot().catch((err) => {
  console.error(err)
  process.exit(1)
})
