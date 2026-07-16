import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'
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
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: '瞬劇魔法師 · InstantDrama Magician',
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
  registerIpcHandlers({
    ipcMain,
    dialog,
    shell,
    getPrisma,
    getMainWindow: () => mainWindow
  })

  createWindow()

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
