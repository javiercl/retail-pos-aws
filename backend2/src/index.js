import express from 'express'
import { Pool } from 'pg';
import AWS from 'aws-sdk';
AWS.config.update({ region: 'us-west-2' });

const app = express()
const port = Number(process.env.PORT || 8080)

const dbHost = process.env.DB_HOST || 'mi-bd-prueba-instance-1.ccuu52uctcpx.us-west-2.rds.amazonaws.com';
const dbPort = Number(process.env.DB_PORT || 5432);
const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || process.env.password;
const dbName = process.env.DB_NAME || 'postgres';

if (!dbPassword) {
  console.warn('Advertencia: DB_PASSWORD no esta definido.');
}

const pool = new Pool({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  ssl: { rejectUnauthorized: false }
});

app.get('/', async (_req, res) => {
  try {
    const result = await pool.query('SELECT version()');
    res.type('text/plain').send('hola mundo: ' + result.rows[0].version.toString());
  } catch (err) {
    console.error('Error en la consulta:', {
      host: dbHost,
      port: dbPort,
      code: err?.code,
      message: err?.message
    });
    res.status(500).send('Error en la base de datos');
  }
});

app.listen(port, () => {
  console.log(`Escuchando en ${port}`)
})
