import http from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve('work/dashboard-preview')
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' }
http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname
    const file = path.join(root, pathname === '/' ? 'index.html' : pathname.slice(1))
    if (!file.startsWith(root)) throw new Error('Invalid path')
    let body
    let servedFile = file
    try { body = await readFile(file) } catch { servedFile = path.join(root, 'index.html'); body = await readFile(servedFile) }
    res.writeHead(200, { 'content-type': mime[path.extname(servedFile)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404); res.end('Not found')
  }
}).listen(4173, '127.0.0.1', () => console.log('Preview at http://127.0.0.1:4173'))
