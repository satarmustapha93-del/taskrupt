import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.js'
import taskRoutes from './routes/tasks.js'
import walletRoutes from './routes/wallet.js'
import adminRoutes from './routes/admin.js'

const app = express()
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }))
app.use(express.json({ limit: '3mb' }))
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'TaskRupt API' }))
app.use('/api/auth', authRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/wallet', walletRoutes)
app.use('/api/admin', adminRoutes)
app.use((err, _req, res, _next) => {
  console.error(err)
  const message = err.message || 'Server error'
  const status = err.status || (message.includes('already claimed') || message.includes('waiting for review') ? 409 : message.includes('cooldown') ? 429 : message.includes('not found') ? 404 : message.includes('required') || message.includes('Insufficient') || message.includes('Minimum withdrawal') ? 400 : message.includes('unavailable') ? 403 : 500)
  res.status(status).json({ message })
})

const port = process.env.PORT || 4000
app.listen(port, () => console.log(`TaskRupt API listening on ${port}`))

export default app
