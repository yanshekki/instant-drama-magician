import { app, BrowserWindow, ipcMain, dialog, shell, protocol } from 'electron'
import { extname, join, resolve as pathResolve, sep } from 'path'
import { createReadStream, existsSync, readFileSync, statSync } from 'fs'
import { Readable } from 'stream'
import { PrismaClient } from '../../src/types/prisma'
import { appUpdateService } from '../../src/infrastructure/update/AppUpdateService'
import { registerIpcHandlers } from './ipc'

/** MIME for idm-media responses (video needs correct type + Range). */
function mimeForMediaPath(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case '.mp4':
    case '.m4v':
      return 'video/mp4'
    case '.webm':
      return 'video/webm'
    case '.mov':
      return 'video/quicktime'
    case '.mkv':
      return 'video/x-matroska'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    case '.svg':
      return 'image/svg+xml'
    case '.wav':
      return 'audio/wav'
    case '.mp3':
      return 'audio/mpeg'
    default:
      return 'application/octet-stream'
  }
}

/**
 * Serve local media with Accept-Ranges / 206 Partial Content so Chromium
 * <video> can stream past the first buffer (otherwise playback often stops ~1s).
 */
function serveLocalMediaFile(
  filePath: string,
  request: Request
): Response {
  const st = statSync(filePath)
  const size = st.size
  const type = mimeForMediaPath(filePath)
  const rangeHeader =
    request.headers.get('Range') ?? request.headers.get('range')

  if (rangeHeader) {
    const m = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim())
    if (!m) {
      return new Response('invalid range', { status: 416 })
    }
    let start = m[1] !== '' ? Number.parseInt(m[1], 10) : 0
    let end = m[2] !== '' ? Number.parseInt(m[2], 10) : size - 1
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      start >= size ||
      end < start
    ) {
      return new Response('range not satisfiable', {
        status: 416,
        headers: {
          'Content-Range': `bytes */${size}`,
          'Accept-Ranges': 'bytes'
        }
      })
    }
    end = Math.min(end, size - 1)
    const chunkSize = end - start + 1
    const nodeStream = createReadStream(filePath, { start, end })
    const webStream = Readable.toWeb(nodeStream) as ReadableStream
    return new Response(webStream, {
      status: 206,
      headers: {
        'Content-Type': type,
        'Content-Length': String(chunkSize),
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=0, must-revalidate'
      }
    })
  }

  const nodeStream = createReadStream(filePath)
  const webStream = Readable.toWeb(nodeStream) as ReadableStream
  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Content-Length': String(size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=0, must-revalidate'
    }
  })
}

const isDev = !app.isPackaged

// Resolve SQLite path relative to project root (dev) or userData (prod)
function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  if (isDev) {
    return `file:${join(process.cwd(), 'prisma', 'dev.db')}`
  }
  return `file:${join(app.getPath('userData'), 'instant-drama.db')}`
}

process.env.DATABASE_URL = resolveDatabaseUrl()

// Must be called before app ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'idm-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
])

let mainWindow: BrowserWindow | null = null
let prisma: PrismaClient | null = null

function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } }
    })
  }
  return prisma
}

function createWindow(): void {
  const version = app.getVersion()
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: `瞬劇魔法師 · InstantDrama Magician v${version}`,
    backgroundColor: '#020617',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  const mediaRoot = join(app.getPath('userData'), 'media')
  protocol.handle('idm-media', (request) => {
    try {
      const u = new URL(request.url)
      const p = u.searchParams.get('p')
      if (!p) return new Response('missing path', { status: 400 })
      const filePath = decodeURIComponent(p)
      // Path traversal protection: only allow files under userData/media
      const resolved = pathResolve(filePath)
      const root = pathResolve(mediaRoot)
      if (!resolved.startsWith(root + sep) && resolved !== root) {
        return new Response('forbidden', { status: 403 })
      }
      if (!existsSync(resolved)) {
        return new Response('not found', { status: 404 })
      }
      return serveLocalMediaFile(resolved, request)
    } catch {
      return new Response('bad request', { status: 400 })
    }
  })

  registerIpcHandlers({
    ipcMain,
    dialog,
    shell,
    getPrisma,
    getMainWindow: () => mainWindow
  })

  appUpdateService.bindWindow(() => mainWindow)
  createWindow()

  // Auto-start local Grok Gateway when using grok-gateway preset (no manual gctoac start)
  setTimeout(() => {
    void (async () => {
      try {
        const { SettingsStore } = await import(
          '../../src/infrastructure/settings/SettingsStore'
        )
        const { getGrokGatewayService } = await import(
          '../../src/infrastructure/gateway/GrokGatewayService'
        )
        const store = new SettingsStore(
          join(app.getPath('userData'), 'settings.json')
        )
        const s = store.load()
        const needsGw =
          s.llmProvider === 'grok-gateway' ||
          s.imageProvider === 'grok-gateway' ||
          s.videoProvider === 'grok-gateway'
        if (needsGw) {
          const gw = getGrokGatewayService()
          const { status, apiKey } = await gw.ensureRunningWithApiKey(s.apiKey)
          if (apiKey && apiKey !== s.apiKey) {
            store.save({
              ...s,
              apiKey,
              baseUrl: gw.baseUrl,
              llmProvider:
                s.llmProvider === 'grok-gateway' || !s.llmProvider
                  ? 'grok-gateway'
                  : s.llmProvider
            })
          } else if (status.healthOk && !s.baseUrl?.includes('3847')) {
            store.save({ ...s, baseUrl: gw.baseUrl })
          }
        }
      } catch {
        /* non-fatal — UI will surface gateway status */
      }
    })()
  }, 1500)

  // Packaged builds: quiet check a few seconds after launch (non-blocking)
  if (app.isPackaged) {
    setTimeout(() => {
      void appUpdateService.check().catch(() => undefined)
    }, 8000)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  if (prisma) {
    await prisma.$disconnect()
  }
})

// Expose helpers for soul.md import validation in main process
export function readSoulMd(filePath: string): string | null {
  if (!existsSync(filePath)) return null
  if (!filePath.toLowerCase().endsWith('.md')) return null
  return readFileSync(filePath, 'utf-8')
}
