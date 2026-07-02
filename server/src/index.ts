import cors from 'cors'
import express from 'express'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { closeDatabase } from './db.js'
import { categoriesRouter } from './routes/categories.js'
import { categoryMappingsRouter } from './routes/categoryMappings.js'
import { operationsRouter } from './routes/operations.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appEnv = process.env.APP_ENV ?? 'development'
const isProduction = appEnv === 'production'

const app = express()
const port = Number(process.env.PORT ?? (isProduction ? 3002 : 3001))

app.use(cors())
app.use('/api/operations/upload', express.raw({ type: 'application/octet-stream', limit: '10mb' }))
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', env: appEnv })
})

app.use('/api/operations', operationsRouter)
app.use('/api/categories', categoriesRouter)
app.use('/api/category-mappings', categoryMappingsRouter)

if (isProduction) {
  const distDir = join(__dirname, '../../dist')
  app.use(express.static(distDir))
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) {
      next()
      return
    }
    res.sendFile(join(distDir, 'index.html'))
  })
}

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
  console.log(`API server running at http://localhost:${port} (${appEnv})`)
})

function shutdown() {
  server.close(() => {
    closeDatabase()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
