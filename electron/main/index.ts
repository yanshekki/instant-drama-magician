import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } from 'electron'
import { join, resolve as pathResolve, sep } from 'path'
import { existsSync, readFileSync } from 'fs'
import { pathToFileURL } from 'url'
import { PrismaClient } from '../../src/types/prisma'
import { appUpdateService } from '../../src/infrastructure/update/AppUpdateService'
import { registerIpcHandlers } from './ipc'

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
      return net.fetch(pathToFileURL(resolved).toString())
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
