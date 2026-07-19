/**
 * Electron IPC bridge — thin wrapper over shared runtime handlers.
 * All business channels live in src/runtime/registerAllHandlers.ts
 */
import type {
  BrowserWindow,
  Dialog,
  IpcMain,
  IpcMainInvokeEvent,
  OpenDialogOptions,
  SaveDialogOptions,
  Shell
} from 'electron'
import { app, BrowserWindow as BW } from 'electron'
import type { PrismaClient } from '../../src/types/prisma'
import { join } from 'path'
import { SettingsStore } from '../../src/infrastructure/settings/SettingsStore'
import { ActivityLog } from '../../src/infrastructure/activity/ActivityLog'
import { AppError, toAppError } from '../../src/types/errors'
import { createRuntime, type AppRuntime } from '../../src/runtime/createRuntime'
import type {
  HandlerDialog,
  HandlerHost,
  HandlerShell
} from '../../src/runtime/HandlerHost'

export interface IpcContext {
  ipcMain: IpcMain
  dialog: Dialog
  shell: Shell
  getPrisma: () => PrismaClient
  getMainWindow: () => BrowserWindow | null
  rebuildApplicationMenu?: () => void
  resolveDatabasePath?: () => string
  exportFullBackup?: () => void | Promise<void>
  importFullBackup?: () => void | Promise<void>
}

/** Redact secrets from IPC args for audit log. */
function summarizeArgs(channel: string, args: unknown[]): unknown {
  try {
    const raw = JSON.parse(JSON.stringify(args)) as unknown[]
    if (channel === 'settings:set' && raw[0] && typeof raw[0] === 'object') {
      const o = raw[0] as Record<string, unknown>
      if (typeof o.apiKey === 'string' && o.apiKey) o.apiKey = '[redacted]'
      if (typeof o.ttsHttpUrl === 'string' && o.ttsHttpUrl) o.ttsHttpUrl = '[set]'
    }
    const s = JSON.stringify(raw)
    if (s.length > 2000) return { truncated: true, preview: s.slice(0, 2000) }
    return raw
  } catch {
    return { note: 'unserializable_args' }
  }
}

let _runtime: AppRuntime | null = null
let _activity: ActivityLog | null = null

export function getIpcRuntime(): AppRuntime | null {
  return _runtime
}

function electronDialog(dialog: Dialog, getMainWindow: () => BrowserWindow | null): HandlerDialog {
  return {
    showOpenDialog: async (winOrOpts, maybeOpts) => {
      const hasWin =
        winOrOpts &&
        typeof winOrOpts === 'object' &&
        winOrOpts !== null &&
        'webContents' in (winOrOpts as object)
      const options = (hasWin ? maybeOpts : winOrOpts) as OpenDialogOptions
      const win = hasWin
        ? (winOrOpts as BrowserWindow)
        : getMainWindow()
      const result = win
        ? await dialog.showOpenDialog(win, options || {})
        : await dialog.showOpenDialog(options || {})
      return {
        canceled: result.canceled,
        filePaths: result.filePaths
      }
    },
    showSaveDialog: async (winOrOpts, maybeOpts) => {
      const hasWin =
        winOrOpts &&
        typeof winOrOpts === 'object' &&
        winOrOpts !== null &&
        'webContents' in (winOrOpts as object)
      const options = (hasWin ? maybeOpts : winOrOpts) as SaveDialogOptions
      const win = hasWin
        ? (winOrOpts as BrowserWindow)
        : getMainWindow()
      const result = win
        ? await dialog.showSaveDialog(win, options || {})
        : await dialog.showSaveDialog(options || {})
      return {
        canceled: result.canceled,
        filePath: result.filePath
      }
    }
  }
}

function electronShell(shell: Shell): HandlerShell {
  return {
    openExternal: (url) => shell.openExternal(url),
    openPath: (p) => shell.openPath(p),
    showItemInFolder: (p) => {
      shell.showItemInFolder(p)
    }
  }
}

export function registerIpcHandlers(ctx: IpcContext): void {
  const { ipcMain, dialog, shell, getPrisma, getMainWindow } = ctx
  const userData = app.getPath('userData')
  const mediaRoot = join(userData, 'media')
  const settingsStore = new SettingsStore(SettingsStore.defaultPath(userData))
  const activity = new ActivityLog(ActivityLog.defaultPath(userData))
  _activity = activity

  let lastProgress: unknown = null
  let adminWindow: BrowserWindow | null = null

  const hostOverrides: Partial<HandlerHost> = {
    mode: 'electron',
    userData,
    mediaRoot,
    appVersion: app.getVersion(),
    isPackaged: app.isPackaged,
    platform: process.platform,
    getPrisma,
    settingsStore,
    activity,
    dialog: electronDialog(dialog, getMainWindow),
    shell: electronShell(shell),
    getMainWindow: () => getMainWindow(),
    rebuildApplicationMenu: ctx.rebuildApplicationMenu,
    resolveDatabasePath: ctx.resolveDatabasePath,
    exportFullBackup: ctx.exportFullBackup,
    importFullBackup: ctx.importFullBackup,
    emitGenerationProgress: (payload) => {
      lastProgress = payload
      const win = getMainWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send('generation:progress', payload)
      }
    },
    getLastGenerationProgress: () => lastProgress,
    openAdminWindow: async (target: string) => {
      const {
        getGrokGatewayService
      } = await import('../../src/infrastructure/gateway/GrokGatewayService')
      const gw = getGrokGatewayService()
      const st = await gw.ensureRunning()
      if (adminWindow && !adminWindow.isDestroyed()) {
        adminWindow.focus()
        if (adminWindow.webContents.getURL() !== target) {
          await adminWindow.loadURL(target)
        }
        return {
          ok: true as const,
          url: target,
          reused: true as const,
          state: st.state,
          healthOk: st.healthOk
        }
      }
      adminWindow = new BW({
        width: 1100,
        height: 800,
        minWidth: 720,
        minHeight: 480,
        title: 'Grok Gateway Admin',
        backgroundColor: '#0f172a',
        autoHideMenuBar: true,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true
        }
      })
      adminWindow.on('closed', () => {
        adminWindow = null
      })
      adminWindow.webContents.setWindowOpenHandler(({ url: u }) => {
        if (/^https?:\/\//i.test(u)) {
          void shell.openExternal(u).catch(() => undefined)
        }
        return { action: 'deny' }
      })
      await adminWindow.loadURL(target)
      adminWindow.focus()
      return {
        ok: true as const,
        url: target,
        reused: false as const,
        state: st.state,
        healthOk: st.healthOk
      }
    }
  }

  // Prefer Electron userData DB when available
  const dbPath =
    ctx.resolveDatabasePath?.() || join(userData, 'instant-drama.db')
  const databaseUrl = `file:${dbPath}`

  const runtime = createRuntime({
    dataDir: userData,
    databaseUrl,
    appVersion: app.getVersion(),
    platform: process.platform,
    isPackaged: app.isPackaged,
    hostOverrides
  })
  _runtime = runtime

  // Force electron mode flags (createRuntime may set headless overrides)
  // Re-bind app:getInfo for desktop identity
  const channels = runtime.channels()

  for (const channel of channels) {
    ipcMain.handle(channel, async (_event: IpcMainInvokeEvent, ...args: unknown[]) => {
      const t0 = Date.now()
      try {
        const result = await runtime.invoke(channel, args)
        if (!channel.startsWith('activity:')) {
          activity.append({
            kind: 'ipc',
            level: 'info',
            message: channel,
            meta: {
              ok: true,
              ms: Date.now() - t0,
              args: summarizeArgs(channel, args)
            }
          })
        }
        return result
      } catch (error) {
        const body = toAppError(error)
        if (!channel.startsWith('activity:')) {
          activity.append({
            kind: 'ipc',
            level: 'error',
            message: channel,
            meta: {
              ok: false,
              ms: Date.now() - t0,
              code: body.code,
              error: body.message,
              details: body.details ?? null,
              args: summarizeArgs(channel, args)
            }
          })
        }
        throw new Error(JSON.stringify(body))
      }
    })
  }

  activity.append({
    kind: 'app',
    level: 'info',
    message: 'ipc_handlers_registered',
    meta: { userData, channels: channels.length }
  })
}

/** @deprecated use AppError from types — kept for any external import */
export { AppError }
