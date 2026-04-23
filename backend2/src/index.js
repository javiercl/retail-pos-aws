import express from 'express';
import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

const app = express();
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false
  }
});

app.get('/time', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ serverTime: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error conectando a la BD' });
  }
});

const basePort = Number(process.env.PORT || 3000);

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`Servidor corriendo en puerto ${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      console.warn(`Puerto ${port} en uso, intentando ${nextPort}...`);
      startServer(nextPort);
      return;
    }
    throw err;
  });
}

startServer(basePort);