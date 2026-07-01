import cors from 'cors'
import express from 'express'
import { closeDatabase } from './db.js'
import { categoriesRouter } from './routes/categories.js'
import { categoryMappingsRouter } from './routes/categoryMappings.js'
import { operationsRouter } from './routes/operations.js'

const app = express()
const port = Number(process.env.PORT ?? 3001)

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/operations', operationsRouter)
app.use('/api/categories', categoriesRouter)
app.use('/api/category-mappings', categoryMappingsRouter)

app.use((_req, res) => {
  res.status(404).json({ message: 'Маршрут не найден.' })
})

app.use(
  (
    error: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(error)
    res.status(500).json({ message: 'Внутренняя ошибка сервера.' })
  },
)

const server = app.listen(port, () => {
  console.log(`API server running at http://localhost:${port}`)
})

function shutdown() {
  server.close(() => {
    closeDatabase()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
