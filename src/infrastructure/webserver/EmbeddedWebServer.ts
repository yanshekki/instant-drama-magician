/**
 * Controllable HTTP server for browser remote control.
 * Used by CLI (`server/index.ts`) and Electron (Settings toggle).
 */
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from 'http'
import {
  createReadStream,
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync
} from 'fs'
import { basename, extname, join, resolve } from 'path'
import { createRuntime, type AppRuntime } from '../../runtime/createRuntime'
import { toAppError } from '../../types/errors'
import { randomBytes } from 'crypto'

export interface WebServerStartOptions {
  dataDir: string
  port: number
  host?: string
  authToken?: string
  /** When true, skip auth (dev only). */
  authDisabled?: boolean
  staticDir?: string
  appVersion?: string
  isPackaged?: boolean
}

export interface WebServerStatus {
  running: boolean
  port: number
  host: string
  url: string
  authToken: string
  authRequired: boolean
  authDisabled: boolean
  staticReady: boolean
  error: string | null
  channels: number
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon'
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  })
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage): Promise<string> {
  return readBodyBuffer(req).then((b) => b.toString('utf8'))
}

function readBodyBuffer(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    const MAX = 512 * 1024 * 1024 // 512MB
    req.on('data', (c) => {
      const buf = Buffer.from(c)
      total += buf.length
      if (total > MAX) {
        reject(new Error('Upload too large (max 512MB)'))
        req.destroy()
        return
      }
      chunks.push(buf)
    })
    req.on('end', () => resolveBody(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export function generateWebServerToken(): string {
  return randomBytes(24).toString('hex')
}

export class EmbeddedWebServer {
  private server: Server | null = null
  private runtime: AppRuntime | null = null
  private port = 8787
  private host = '0.0.0.0'
  private authToken = ''
  private authDisabled = false
  private staticDir = ''
  private appVersion = '1.0.0'
  private lastError: string | null = null

  getStatus(): WebServerStatus {
    const running = Boolean(this.server?.listening)
    const displayHost =
      this.host === '0.0.0.0' || this.host === '::' ? '127.0.0.1' : this.host
    return {
      running,
      port: this.port,
      host: this.host,
      url: `http://${displayHost}:${this.port}/`,
      authToken: this.authToken,
      authRequired: !this.authDisabled && Boolean(this.authToken),
      authDisabled: this.authDisabled,
      staticReady: this.staticDir ? existsSync(this.staticDir) : false,
      error: this.lastError,
      channels: this.runtime?.channels().length ?? 0
    }
  }

  async start(opts: WebServerStartOptions): Promise<WebServerStatus> {
    if (this.server?.listening) {
      await this.stop()
    }

    this.port = Math.max(1, Math.min(65535, Math.floor(opts.port) || 8787))
    this.host = (opts.host || '0.0.0.0').trim() || '0.0.0.0'
    this.authToken = (opts.authToken || '').trim()
    this.authDisabled = Boolean(opts.authDisabled)
    this.appVersion = opts.appVersion || '1.0.0'
    this.staticDir = resolve(
      opts.staticDir || join(process.cwd(), 'out', 'renderer')
    )
    this.lastError = null

    const dataDir = resolve(opts.dataDir)
    mkdirSync(dataDir, { recursive: true })

    try {
      // Prefer dataDir DB — do not inherit process.env.DATABASE_URL (e.g. ./prisma/dev.db)
      this.runtime = createRuntime({
        dataDir,
        databaseUrl: `file:${join(dataDir, 'instant-drama.db')}`,
        appVersion: this.appVersion,
        isPackaged: opts.isPackaged,
        platform: process.platform
      })
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e)
      throw e
    }

    const runtime = this.runtime
    const authDisabled = this.authDisabled
    const authToken = this.authToken
    const staticDir = this.staticDir
    const appVersion = this.appVersion

    const checkAuth = (req: IncomingMessage): boolean => {
      if (authDisabled) return true
      if (!authToken) {
        const ra = req.socket.remoteAddress || ''
        return (
          ra === '127.0.0.1' ||
          ra === '::1' ||
          ra === '::ffff:127.0.0.1'
        )
      }
      const h = req.headers.authorization || ''
      let bearer = ''
      if (h.toLowerCase().startsWith('bearer ')) bearer = h.slice(7).trim()
      if (!bearer) {
        try {
          const u = new URL(
            req.url || '/',
            `http://${req.headers.host || 'localhost'}`
          )
          bearer = (u.searchParams.get('token') || '').trim()
        } catch {
          /* ignore */
        }
      }
      return bearer === authToken
    }

    const serveStatic = (req: IncomingMessage, res: ServerResponse): void => {
      if (!existsSync(staticDir)) {
        sendJson(res, 503, {
          message:
            'SPA not built. Run npm run build:web, or open via Electron UI only for API.'
        })
        return
      }
      const u = new URL(req.url || '/', `http://${req.headers.host}`)
      let rel = decodeURIComponent(u.pathname)
      if (rel === '/') rel = '/index.html'
      let filePath = join(staticDir, rel)
      if (
        !filePath.startsWith(staticDir) ||
        !existsSync(filePath) ||
        statSync(filePath).isDirectory()
      ) {
        filePath = join(staticDir, 'index.html')
      }
      if (!existsSync(filePath)) {
        res.writeHead(404)
        res.end('Not found')
        return
      }
      const ext = extname(filePath).toLowerCase()
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600'
      })
      createReadStream(filePath).pipe(res)
    }

    const mimeFor = (p: string): string =>
      MIME[extname(p).toLowerCase()] || 'application/octet-stream'

    this.server = createServer(async (req, res) => {
      const method = req.method || 'GET'
      const url = req.url || '/'

      res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Authorization, Content-Type'
      )
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      if (method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }

      try {
        if (
          method === 'GET' &&
          (url === '/api/health' || url.startsWith('/api/health?'))
        ) {
          sendJson(res, 200, {
            ok: true,
            version: appVersion,
            runtime: 'web',
            channels: runtime.channels().length,
            authRequired: !authDisabled && Boolean(authToken),
            authDisabled
          })
          return
        }

        if (method === 'GET' && url.startsWith('/api/channels')) {
          if (!checkAuth(req)) {
            sendJson(res, 401, { message: 'Unauthorized' })
            return
          }
          sendJson(res, 200, { channels: runtime.channels() })
          return
        }

        if (method === 'POST' && url.startsWith('/api/invoke')) {
          if (!checkAuth(req)) {
            sendJson(res, 401, {
              code: 'AI_UNAUTHORIZED',
              message:
                'Unauthorized — set Authorization: Bearer <token>'
            })
            return
          }
          const raw = await readBody(req)
          let parsed: { channel?: string; args?: unknown[] }
          try {
            parsed = JSON.parse(raw || '{}') as {
              channel?: string
              args?: unknown[]
            }
          } catch {
            sendJson(res, 400, { message: 'Invalid JSON body' })
            return
          }
          const channel = String(parsed.channel || '')
          const args = Array.isArray(parsed.args) ? parsed.args : []
          if (!channel) {
            sendJson(res, 400, { message: 'channel is required' })
            return
          }
          try {
            const result = await runtime.invoke(channel, args)
            sendJson(res, 200, { ok: true, result })
          } catch (err) {
            const body = toAppError(err)
            const status =
              body.code === 'NOT_FOUND'
                ? 404
                : body.code === 'VALIDATION'
                  ? 400
                  : body.code === 'AI_UNAUTHORIZED'
                    ? 401
                    : 500
            sendJson(res, status, { ok: false, error: body })
          }
          return
        }

        if (method === 'GET' && url.startsWith('/api/media')) {
          if (!checkAuth(req)) {
            sendJson(res, 401, { message: 'Unauthorized' })
            return
          }
          const u = new URL(url, `http://${req.headers.host}`)
          const p = u.searchParams.get('p') || ''
          const abs = runtime.resolveMediaPath(p)
          if (!abs) {
            res.writeHead(404)
            res.end('Not found')
            return
          }
          const st = statSync(abs)
          res.writeHead(200, {
            'Content-Type': mimeFor(abs),
            'Content-Length': st.size,
            'Cache-Control': 'private, max-age=60'
          })
          createReadStream(abs).pipe(res)
          return
        }

        // Attachment download (export / save-as)
        if (method === 'GET' && url.startsWith('/api/download')) {
          if (!checkAuth(req)) {
            sendJson(res, 401, { message: 'Unauthorized' })
            return
          }
          const u = new URL(url, `http://${req.headers.host}`)
          const p = u.searchParams.get('p') || ''
          const abs = runtime.resolveMediaPath(p)
          if (!abs) {
            res.writeHead(404)
            res.end('Not found')
            return
          }
          const st = statSync(abs)
          const name = basename(abs)
          res.writeHead(200, {
            'Content-Type': mimeFor(abs),
            'Content-Length': st.size,
            'Content-Disposition': `attachment; filename="${name.replace(/"/g, '')}"`,
            'Cache-Control': 'no-store'
          })
          createReadStream(abs).pipe(res)
          return
        }

        // Raw body upload (zip / images) → media/uploads
        if (method === 'POST' && url.startsWith('/api/upload')) {
          if (!checkAuth(req)) {
            sendJson(res, 401, { message: 'Unauthorized' })
            return
          }
          try {
            const u = new URL(url, `http://${req.headers.host}`)
            const rawName = u.searchParams.get('name') || `upload-${Date.now()}`
            const safeName = basename(rawName).replace(
              /[^\w.\-()+\u4e00-\u9fff]/g,
              '_'
            )
            const sub = (u.searchParams.get('subdir') || 'uploads').replace(
              /\.\./g,
              ''
            )
            const destDir = join(runtime.mediaRoot, sub || 'uploads')
            mkdirSync(destDir, { recursive: true })
            const dest = join(
              destDir,
              `${Date.now()}-${safeName || 'file'}`
            )
            const buf = await readBodyBuffer(req)
            writeFileSync(dest, buf)
            sendJson(res, 200, {
              ok: true,
              filePath: dest,
              fileName: basename(dest),
              bytes: buf.length
            })
          } catch (err) {
            sendJson(res, 400, {
              message: err instanceof Error ? err.message : String(err)
            })
          }
          return
        }

        if (method === 'GET' && !url.startsWith('/api/')) {
          serveStatic(req, res)
          return
        }

        sendJson(res, 404, { message: 'Not found' })
      } catch (err) {
        sendJson(res, 500, {
          message: err instanceof Error ? err.message : String(err)
        })
      }
    })

    await new Promise<void>((resolveListen, reject) => {
      const onErr = (err: Error): void => {
        this.lastError = err.message
        this.server = null
        reject(err)
      }
      this.server!.once('error', onErr)
      this.server!.listen(this.port, this.host, () => {
        this.server!.off('error', onErr)
        this.lastError = null
        resolveListen()
      })
    })

    return this.getStatus()
  }

  async stop(): Promise<WebServerStatus> {
    const server = this.server
    this.server = null
    if (server) {
      await new Promise<void>((resolveClose) => {
        server.close(() => resolveClose())
        // Force-close if stuck
        setTimeout(() => resolveClose(), 2000)
      })
    }
    if (this.runtime) {
      try {
        await this.runtime.dispose()
      } catch {
        /* ignore */
      }
      this.runtime = null
    }
    this.lastError = null
    return this.getStatus()
  }
}

/** Process-wide singleton for Electron main. */
let shared: EmbeddedWebServer | null = null

export function getEmbeddedWebServer(): EmbeddedWebServer {
  if (!shared) shared = new EmbeddedWebServer()
  return shared
}
