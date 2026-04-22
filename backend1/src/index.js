import express from 'express'

const app = express()
const port = Number(process.env.PORT || 8080)

app.get('/', (_req, res) => {
  res.type('text/plain').send('hola mundo')
})

app.listen(port, () => {
  console.log(`Escuchando en ${port}`)
})
