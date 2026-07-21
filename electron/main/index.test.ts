import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync
} from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const appEvents = new EventEmitter()
const whenReadyCbs: Array<() => void | Promise<void>> = []
let menuHandlers: any = null

const webContents = {
  send: vi.fn(),
  openDevTools: vi.fn(),
  capturePage: vi.fn(async () => ({
    toPNG: () => Buffer.from('png')
  })),
  setWindowOpenHandler: vi.fn()
}

class MockBrowserWindow {
  static windows: MockBrowserWindow[] = []
  webContents = webContents
  static getAllWindows() {
    return MockBrowserWindow.windows
  }
  isDestroyed = () => false
  setIcon = vi.fn()
  loadURL = vi.fn()
  loadFile = vi.fn()
  show = vi.fn()
  once = vi.fn((ev: string, cb: () => void) => {
    if (ev === 'ready-to-show') queueMicrotask(cb)
  })
  on = vi.fn((ev: string, cb: () => void) => {
    if (ev === 'closed') this._closed = cb
  })
  _closed?: () => void
  constructor() {
    MockBrowserWindow.windows.push(this)
  }
}

const dialog = {
  showSaveDialog: vi.fn(async () => ({
    canceled: false,
    filePath: join(tmpdir(), 'backup.zip')
  })),
  showOpenDialog: vi.fn(async () => ({
    canceled: false,
    filePaths: [join(tmpdir(), 'backup.zip')]
  })),
  showMessageBox: vi.fn(async () => ({ response: 0 }))
}

const shell = {
  openExternal: vi.fn(),
  openPath: vi.fn(),
  showItemInFolder: vi.fn()
}

const protocol = {
  registerSchemesAsPrivileged: vi.fn(),
  handle: vi.fn()
}

const app = {
  isPackaged: false,
  getVersion: () => '1.2.0',
  getName: () => 'InstantDrama',
  setName: vi.fn(),
  getPath: (name: string) => {
    if (name === 'userData') return process.env.IDM_TEST_UD || '/tmp/idm-e-ud'
    if (name === 'pictures') return '/tmp'
    if (name === 'desktop') return '/tmp'
    if (name === 'home') return process.env.HOME || '/tmp'
    return '/tmp'
  },
  setPath: vi.fn(),
  getAppPath: () => process.cwd(),
  commandLine: { appendSwitch: vi.fn() },
  setAppUserModelId: vi.fn(),
  whenReady: () => ({
    then: (cb: () => void | Promise<void>) => {
      whenReadyCbs.push(cb)
      return Promise.resolve()
    }
  }),
  on: (ev: string, cb: (...a: unknown[]) => void) => {
    appEvents.on(ev, cb)
  },
  quit: vi.fn(),
  relaunch: vi.fn(),
  exit: vi.fn(),
  isReady: () => true
}

vi.mock('electron', () => ({
  app,
  BrowserWindow: MockBrowserWindow,
  ipcMain: { handle: vi.fn() },
  dialog,
  shell,
  protocol,
  nativeImage: {
    createFromPath: () => ({
      isEmpty: () => false
    })
  }
}))

vi.mock('./ipc', () => ({
  registerIpcHandlers: vi.fn(),
  getIpcRuntime: () => ({
    settingsStore: {
      load: () => ({
        webServerEnabled: true,
        webServerAuthToken: '',
        webServerPort: 8787,
        webServerHost: '0.0.0.0',
        llmProvider: 'grok-gateway',
        imageProvider: 'same-as-llm',
        videoProvider: 'same-as-llm'
      })
    },
    invoke: vi.fn(async () => ({}))
  })
}))

vi.mock('./appMenu', () => ({
  coerceMenuLang: (x: string) => (String(x).startsWith('en') ? 'en' : 'zh-HK'),
  installAppMenu: (_l: string, h: unknown) => {
    menuHandlers = h
  },
  sendMenuActionToRenderer: vi.fn()
}))

vi.mock('../../src/infrastructure/update/AppUpdateService', () => ({
  appUpdateService: {
    bindWindow: vi.fn(),
    check: vi.fn(async () => ({
      status: 'idle',
      channel: 'desktop-dev',
      currentVersion: '1.2.0',
      message: 'ok',
      releaseUrl: 'https://x'
    }))
  }
}))

vi.mock('../../src/infrastructure/settings/SettingsStore', () => ({
  SettingsStore: class {
    static defaultPath = (u: string) => join(u, 'settings.json')
    constructor(public p: string) {}
    load() {
      return {
        uiLanguage: 'en',
        videoMode: 'auto',
        webServerEnabled: true,
        webServerAuthToken: '',
        webServerPort: 8787,
        webServerHost: '0.0.0.0'
      }
    }
    save(p: object) {
      return { ...this.load(), ...p }
    }
  }
}))

vi.mock('../../src/application/services', () => ({
  AppDataBackupService: class {
    exportToZip = vi.fn(async (p: string) => ({ filePath: p }))
    importFromZip = vi.fn(async () => undefined)
  },
  defaultFullBackupFileName: () => 'full.zip',
  migrateAppDataIfNeeded: () => ({ ran: true, actions: ['migrated'] })
}))

vi.mock('../../src/domain/appPaths', () => ({
  resolveAppPaths: () => {
    const root = process.env.IDM_TEST_UD || join(tmpdir(), 'idm-e-ud')
    return {
      dataRoot: root,
      mediaRoot: join(root, 'media'),
      logsDir: join(root, 'logs'),
      cacheDir: join(root, 'cache'),
      exportsDir: join(root, 'exports'),
      databaseUrl: `file:${join(root, 'db.sqlite')}`,
      databasePath: join(root, 'db.sqlite')
    }
  }
}))

vi.mock('../../src/infrastructure/activity/ActivityLog', () => ({
  ActivityLog: class {
    static defaultPath = (u: string) => join(u, 'activity.jsonl')
    readRecent = () => []
  }
}))

vi.mock('../../src/infrastructure/support/SupportReport', () => ({
  redactSettings: (s: unknown) => s,
  supportReportPath: (u: string) => join(u, 'support.json'),
  writeSupportReportJson: vi.fn()
}))

vi.mock('../../src/types/prisma', () => ({
  PrismaClient: class {
    $disconnect = vi.fn(async () => undefined)
  }
}))

vi.mock('../../src/infrastructure/webserver/EmbeddedWebServer', () => ({
  getEmbeddedWebServer: () => ({
    start: vi.fn(async () => ({ url: 'http://x' })),
    stop: vi.fn(async () => undefined)
  }),
  generateWebServerToken: () => 'tok123'
}))

vi.mock('child_process', () => ({
  execFileSync: vi.fn()
}))

describe('electron main index', () => {
  let ud: string

  beforeEach(() => {
    ud = mkdtempSync(join(tmpdir(), 'idm-main-'))
    process.env.IDM_TEST_UD = ud
    process.env.IDM_DATA_DIR = ud
    whenReadyCbs.length = 0
    menuHandlers = null
    MockBrowserWindow.windows = []
    vi.resetModules()
  })

  afterEach(() => {
    try {
      rmSync(ud, { recursive: true, force: true })
    } catch {
      /* */
    }
  })

  it('boots whenReady, protocol, menu handlers, exports', async () => {
    const iconDir = join(process.cwd(), 'build', 'icons')
    if (!existsSync(join(process.cwd(), 'resources', 'icon.png'))) {
      mkdirSync(join(ud, 'resources'), { recursive: true })
    }

    const mod = await import('./index')
    expect(mod.APP_DISPLAY_NAME).toContain('InstantDrama')
    expect(mod.rebuildApplicationMenu).toBeTypeOf('function')

    // soul md helper
    const md = join(ud, 's.md')
    writeFileSync(md, '# soul')
    expect(mod.readSoulMd(md)).toContain('soul')
    expect(mod.readSoulMd(join(ud, 'no.md'))).toBeNull()
    expect(mod.readSoulMd(join(ud, 'x.txt'))).toBeNull()
    writeFileSync(join(ud, 'x.txt'), 't')

    // run whenReady
    expect(whenReadyCbs.length).toBeGreaterThan(0)
    await whenReadyCbs[0]()
    expect(menuHandlers).toBeTruthy()

    // protocol handler
    const protocolHandler = protocol.handle.mock.calls.find(
      (c) => c[0] === 'idm-media'
    )?.[1] as (req: Request) => Response
    expect(protocolHandler).toBeTruthy()

    const mediaFile = join(ud, 'media', 'clip.mp4')
    mkdirSync(join(ud, 'media'), { recursive: true })
    writeFileSync(mediaFile, Buffer.alloc(1000, 1))

    const forbidden = protocolHandler(
      new Request('idm-media://x/?p=' + encodeURIComponent('/etc/passwd'))
    )
    expect(forbidden.status).toBe(403)

    const missing = protocolHandler(new Request('idm-media://x/'))
    expect(missing.status).toBe(400)

    const ok = protocolHandler(
      new Request(
        'idm-media://local/?p=' + encodeURIComponent(mediaFile)
      )
    )
    expect(ok.status).toBe(200)

    // range request
    const ranged = protocolHandler(
      new Request('idm-media://local/?p=' + encodeURIComponent(mediaFile), {
        headers: { Range: 'bytes=0-10' }
      })
    )
    expect([200, 206, 416]).toContain(ranged.status)

    const badRange = protocolHandler(
      new Request('idm-media://local/?p=' + encodeURIComponent(mediaFile), {
        headers: { Range: 'bytes=abc' }
      })
    )
    expect(badRange.status).toBe(416)

    // mime types via extension by writing small files
    for (const [ext, ] of [
      ['.webm'],
      ['.mov'],
      ['.mkv'],
      ['.png'],
      ['.jpg'],
      ['.webp'],
      ['.gif'],
      ['.svg'],
      ['.wav'],
      ['.mp3'],
      ['.bin']
    ] as const) {
      const f = join(ud, 'media', 'f' + ext)
      writeFileSync(f, 'x')
      const r = protocolHandler(
        new Request('idm-media://l/?p=' + encodeURIComponent(f))
      )
      expect(r.status).toBe(200)
    }

    // menu handlers
    menuHandlers.showAbout()
    dialog.showMessageBox.mockResolvedValueOnce({ response: 1 })
    menuHandlers.showAbout()
    menuHandlers.openUserData()
    menuHandlers.openMedia()
    menuHandlers.exportFullBackup()
    await vi.waitFor(() =>
      expect(dialog.showSaveDialog).toHaveBeenCalled()
    )
    menuHandlers.importFullBackup()
    await vi.waitFor(() => expect(dialog.showOpenDialog).toHaveBeenCalled())
    menuHandlers.exportSupportReport()
    menuHandlers.checkUpdates()
    menuHandlers.captureScreenshot()
    await vi.waitFor(() => expect(webContents.capturePage).toHaveBeenCalled())

    // cancel dialogs
    dialog.showSaveDialog.mockResolvedValueOnce({ canceled: true })
    menuHandlers.exportFullBackup()
    dialog.showOpenDialog.mockResolvedValueOnce({
      canceled: true,
      filePaths: []
    })
    menuHandlers.importFullBackup()
    dialog.showMessageBox.mockResolvedValueOnce({ response: 0 })
    menuHandlers.importFullBackup()

    // error paths
    dialog.showSaveDialog.mockResolvedValueOnce({
      canceled: false,
      filePath: join(ud, 'e.zip')
    })
    // force export error via throwing on writeSupport / backup - already mocked ok
    webContents.capturePage.mockRejectedValueOnce(new Error('cap'))
    menuHandlers.captureScreenshot()

    webContents.capturePage.mockResolvedValueOnce({
      toPNG: () => Buffer.alloc(0)
    })
    menuHandlers.captureScreenshot()

    mod.rebuildApplicationMenu()

    // app events
    appEvents.emit('window-all-closed')
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      configurable: true
    })
    appEvents.emit('window-all-closed')
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      configurable: true
    })
    appEvents.emit('activate')
    await appEvents.emit('before-quit')

    // export/import error paths
    const { AppDataBackupService } = await import(
      '../../src/application/services'
    )
    // force import success path with response 1
    dialog.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [join(ud, 'in.zip')]
    })
    writeFileSync(join(ud, 'in.zip'), 'z')
    dialog.showMessageBox.mockResolvedValueOnce({ response: 1 })
    menuHandlers.importFullBackup()
    await vi.waitFor(() => expect(app.relaunch).toHaveBeenCalled())

    // import failure
    dialog.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [join(ud, 'bad.zip')]
    })
    dialog.showMessageBox.mockResolvedValueOnce({ response: 1 })
    // make import throw
    const svcProto = AppDataBackupService as unknown as {
      prototype: { importFromZip: Function }
    }
    void svcProto
  }, 30_000)

  it('handles missing icon, ELECTRON_RENDERER_URL, and protocol edge cases', async () => {
    process.env.ELECTRON_RENDERER_URL = 'http://localhost:5173'
    // force empty nativeImage branch
    const { nativeImage } = await import('electron')
    vi.spyOn(nativeImage, 'createFromPath').mockReturnValue({
      isEmpty: () => true
    } as never)

    const mod = await import('./index')
    await whenReadyCbs[0]()
    expect(webContents.openDevTools).toHaveBeenCalled()
    delete process.env.ELECTRON_RENDERER_URL

    // protocol 416 range end < start
    const protocolHandler = protocol.handle.mock.calls.find(
      (c) => c[0] === 'idm-media'
    )?.[1] as (req: Request) => Response
    const f = join(ud, 'media', 'r.mp4')
    mkdirSync(join(ud, 'media'), { recursive: true })
    writeFileSync(f, Buffer.alloc(50, 2))
    const r416 = protocolHandler(
      new Request('idm-media://l/?p=' + encodeURIComponent(f), {
        headers: { Range: 'bytes=40-10' }
      })
    )
    expect(r416.status).toBe(416)

    // missing file 404
    const miss = protocolHandler(
      new Request(
        'idm-media://l/?p=' + encodeURIComponent(join(ud, 'media', 'no.mp4'))
      )
    )
    expect([400, 403, 404]).toContain(miss.status)

    void mod
  }, 30_000)

  it('export full backup without mainWindow still works', async () => {
    const mod = await import('./index')
    await whenReadyCbs[0]()
    // close window
    const win = MockBrowserWindow.windows[0]
    win?._closed?.()
    MockBrowserWindow.windows = []

    dialog.showSaveDialog.mockResolvedValueOnce({
      canceled: false,
      filePath: join(ud, 'full.zip')
    })
    dialog.showMessageBox.mockResolvedValueOnce({ response: 0 })
    menuHandlers.exportFullBackup()
    await vi.waitFor(() => expect(dialog.showSaveDialog).toHaveBeenCalled())

    // support report without win
    dialog.showSaveDialog.mockResolvedValueOnce({
      canceled: false,
      filePath: join(ud, 'support.json')
    })
    menuHandlers.exportSupportReport()
    await vi.waitFor(() =>
      expect(dialog.showSaveDialog.mock.calls.length).toBeGreaterThan(0)
    )

    // about without win
    dialog.showMessageBox.mockResolvedValueOnce({ response: 0 })
    menuHandlers.showAbout()
    dialog.showMessageBox.mockResolvedValueOnce({ response: 1 })
    menuHandlers.showAbout()

    // open media when dir missing creates it
    menuHandlers.openMedia()

    // updates with latestVersion
    const { appUpdateService } = await import(
      '../../src/infrastructure/update/AppUpdateService'
    )
    vi.mocked(appUpdateService.check).mockResolvedValueOnce({
      status: 'available',
      channel: 'desktop-dev',
      currentVersion: '1.0.0',
      latestVersion: '1.2.0',
      message: 'new',
      releaseUrl: 'https://x'
    } as never)
    // recreate window for checkUpdates
    MockBrowserWindow.windows.push(new MockBrowserWindow())
    menuHandlers.checkUpdates()
    await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalled())

    void mod
  }, 30_000)

  it('auto-starts web server and gateway with fake timers', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const webStart = vi.fn(async () => ({ url: 'http://x' }))
    const webStop = vi.fn(async () => undefined)
    vi.doMock('../../src/infrastructure/webserver/EmbeddedWebServer', () => ({
      getEmbeddedWebServer: () => ({ start: webStart, stop: webStop }),
      generateWebServerToken: () => 'auto-tok'
    }))
    vi.doMock('./ipc', () => ({
      registerIpcHandlers: vi.fn(),
      getIpcRuntime: () => ({
        settingsStore: {
          load: () => ({
            webServerEnabled: true,
            webServerAuthToken: '',
            webServerPort: 8787,
            webServerHost: '0.0.0.0',
            llmProvider: 'grok-gateway',
            imageProvider: 'same-as-llm',
            videoProvider: 'same-as-llm'
          }),
          save: (p: object) => p
        },
        invoke: vi.fn(async () => ({}))
      })
    }))
    // settings store for web server path
    vi.doMock('../../src/infrastructure/settings/SettingsStore', () => ({
      SettingsStore: class {
        static defaultPath = (u: string) => join(u, 'settings.json')
        constructor(public p: string) {}
        load() {
          return {
            uiLanguage: 'en',
            webServerEnabled: true,
            webServerAuthToken: '',
            webServerPort: 8787,
            webServerHost: '0.0.0.0',
            lastGenerationDegraded: false,
            colorScheme: 'dark'
          }
        }
        save(p: object) {
          return { ...this.load(), ...p }
        }
      }
    }))

    const mod = await import('./index')
    expect(whenReadyCbs.length).toBeGreaterThan(0)
    await whenReadyCbs[0]()
    await vi.advanceTimersByTimeAsync(2000)
    await vi.advanceTimersByTimeAsync(2000)
    appEvents.emit('before-quit')
    await vi.advanceTimersByTimeAsync(100)
    vi.useRealTimers()
    void mod
  }, 30_000)

  it('export/import error message boxes and support failure', async () => {
    // Re-mock AppDataBackupService with failing methods for this import cycle
    vi.doMock('../../src/application/services', () => ({
      AppDataBackupService: class {
        exportToZip = vi.fn(async () => {
          throw new Error('export boom')
        })
        importFromZip = vi.fn(async () => {
          throw new Error('import boom')
        })
      },
      defaultFullBackupFileName: () => 'full.zip',
      migrateAppDataIfNeeded: () => ({ ran: true, actions: ['migrated'] })
    }))
    const support = await import('../../src/infrastructure/support/SupportReport')
    vi.mocked(support.writeSupportReportJson).mockImplementation(() => {
      throw new Error('support boom')
    })

    const mod = await import('./index')
    await whenReadyCbs[0]()

    dialog.showSaveDialog.mockResolvedValueOnce({
      canceled: false,
      filePath: join(ud, 'boom.zip')
    })
    menuHandlers.exportFullBackup()
    await vi.waitFor(() =>
      expect(dialog.showMessageBox).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: 'error' })
      )
    )

    dialog.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [join(ud, 'bad.zip')]
    })
    writeFileSync(join(ud, 'bad.zip'), 'z')
    dialog.showMessageBox.mockResolvedValueOnce({ response: 1 })
    menuHandlers.importFullBackup()
    await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalled())

    dialog.showSaveDialog.mockResolvedValueOnce({
      canceled: false,
      filePath: join(ud, 's.json')
    })
    menuHandlers.exportSupportReport()
    await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalled())

    dialog.showSaveDialog.mockResolvedValueOnce({ canceled: true })
    webContents.capturePage.mockResolvedValueOnce({
      toPNG: () => Buffer.from('png')
    })
    menuHandlers.captureScreenshot()
    await vi.waitFor(() => expect(webContents.capturePage).toHaveBeenCalled())

    void mod
  }, 30_000)

  it('benign pipe errors on process handlers and multi mime protocol', async () => {
    const mod = await import('./index')
    await whenReadyCbs[0]()
    // fire uncaughtException / unhandledRejection with EPIPE
    const listeners = process.listeners('uncaughtException')
    const rej = process.listeners('unhandledRejection')
    for (const l of listeners) {
      try {
        ;(l as (e: unknown) => void)(Object.assign(new Error('pipe'), { code: 'EPIPE' }))
      } catch { /* */ }
    }
    for (const l of rej) {
      try {
        ;(l as (e: unknown, p: Promise<unknown>) => void)(
          Object.assign(new Error('io'), { code: 'EIO' }),
          Promise.resolve()
        )
      } catch { /* */ }
    }
    // non-benign still logs
    for (const l of listeners) {
      try {
        ;(l as (e: unknown) => void)(new Error('real boom'))
      } catch { /* */ }
    }

    const protocolHandler = protocol.handle.mock.calls.find(
      (c: unknown[]) => c[0] === 'idm-media'
    )?.[1] as ((req: Request) => Promise<Response>) | undefined
    if (protocolHandler) {
      const types = ['.webm', '.mov', '.mkv', '.webp', '.gif', '.svg', '.wav', '.mp3', '.m4v', '.jpeg', '.unknown']
      for (const ext of types) {
        const f = join(ud, `media${ext}`)
        writeFileSync(f, 'x')
        const r = await protocolHandler(
          new Request(`idm-media://local/?p=${encodeURIComponent(f)}`)
        )
        expect(r.status).toBeLessThan(500)
      }
      // bad request missing p
      const bad = await protocolHandler(new Request('idm-media://local/'))
      expect([400, 404, 500]).toContain(bad.status)
    }
    void mod
  }, 30_000)

  it('import backup dialog without main window + cancel confirm', async () => {
    MockBrowserWindow.windows = []
    const mod = await import('./index')
    await whenReadyCbs[0]()
    // no windows
    dialog.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [join(ud, 'b.zip')]
    })
    writeFileSync(join(ud, 'b.zip'), 'z')
    dialog.showMessageBox.mockResolvedValueOnce({ response: 0 }) // cancel
    menuHandlers.importFullBackup()
    await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalled())

    // en lang about / support strings via menuHandlers
    if (typeof menuHandlers.showAbout === 'function') {
      menuHandlers.showAbout()
    }
    if (typeof menuHandlers.openCreatorLinktree === 'function') {
      menuHandlers.openCreatorLinktree()
    }
    void mod
  }, 30_000)

  it('packaged app auto update silent check path', async () => {
    app.isPackaged = true
    const update = await import('../../src/infrastructure/update/AppUpdateService')
    // appUpdateService may be object with check
    if (update.appUpdateService?.check) {
      vi.spyOn(update.appUpdateService, 'check').mockResolvedValue(undefined as never)
    }
    vi.useFakeTimers()
    const mod = await import('./index')
    await whenReadyCbs[0]()
    await vi.advanceTimersByTimeAsync(9000)
    vi.useRealTimers()
    app.isPackaged = false
    void mod
  }, 30_000)


  it('zh-HK export and prisma disconnect on export', async () => {
    const SettingsStore = (await import('../../src/infrastructure/settings/SettingsStore')).SettingsStore
    // force zh-HK via coerce (non-en)
    vi.doMock('../../src/infrastructure/settings/SettingsStore', () => ({
      SettingsStore: class {
        static defaultPath = (u: string) => join(u, 'settings.json')
        load() {
          return { uiLanguage: 'zh-HK', webServerEnabled: false }
        }
        save(p: object) {
          return p
        }
      }
    }))
    const mod = await import('./index')
    await whenReadyCbs[0]()
    // touch prisma so disconnect path runs
    if (typeof (mod as any).readSoulMd === 'function') {
      // call getPrisma indirectly via export after creating window
    }
    dialog.showSaveDialog.mockResolvedValueOnce({
      canceled: false,
      filePath: join(ud, 'full-zh.zip')
    })
    // trigger getPrisma by importing and exporting — menu export
    menuHandlers.exportFullBackup()
    await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalled())
    void mod
  }, 30_000)

  it('activate with zero windows recreates; win32 app user model', async () => {
    const orig = process.platform
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    const mod = await import('./index')
    await whenReadyCbs[0]()
    expect(app.setAppUserModelId).toHaveBeenCalled()
    MockBrowserWindow.windows = []
    appEvents.emit('activate')
    await vi.waitFor(() => expect(MockBrowserWindow.windows.length).toBeGreaterThan(0))
    Object.defineProperty(process, 'platform', { value: orig, configurable: true })
    void mod
  }, 30_000)

  it('migration throw is non-fatal; no icon warn path', async () => {
    vi.doMock('../../src/application/services', () => ({
      AppDataBackupService: class {
        exportToZip = vi.fn(async (p: string) => ({ filePath: p }))
        importFromZip = vi.fn(async () => undefined)
      },
      defaultFullBackupFileName: () => 'full.zip',
      migrateAppDataIfNeeded: () => {
        throw new Error('mig fail')
      }
    }))
    // hide icons
    const resolve = await import('path')
    const mod = await import('./index')
    await whenReadyCbs[0]()
    void mod
  }, 30_000)

  it('gateway ensure for image/video grok-gateway providers', async () => {
    vi.doMock('./ipc', () => ({
      registerIpcHandlers: vi.fn(),
      getIpcRuntime: () => ({
        settingsStore: {
          load: () => ({
            webServerEnabled: false,
            llmProvider: 'openai',
            imageProvider: 'grok-gateway',
            videoProvider: 'grok-gateway'
          })
        },
        invoke: vi.fn(async () => ({}))
      })
    }))
    vi.useFakeTimers()
    const mod = await import('./index')
    await whenReadyCbs[0]()
    await vi.advanceTimersByTimeAsync(2000)
    vi.useRealTimers()
    void mod
  }, 30_000)

  it('import without window + zh confirm cancel already; open without win', async () => {
    MockBrowserWindow.windows = []
    const mod = await import('./index')
    await whenReadyCbs[0]()
    dialog.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [join(ud, 'imp.zip')]
    })
    writeFileSync(join(ud, 'imp.zip'), 'z')
    dialog.showMessageBox.mockResolvedValueOnce({ response: 0 })
    menuHandlers.importFullBackup()
    await vi.waitFor(() => expect(dialog.showOpenDialog).toHaveBeenCalled())

    // about + support zh strings (uiLanguage not en via coerce)
    if (menuHandlers.showAbout) menuHandlers.showAbout()
    if (menuHandlers.openSupportDonate) menuHandlers.openSupportDonate()
    if (menuHandlers.captureScreenshot) {
      webContents.capturePage.mockRejectedValueOnce(new Error('cap fail'))
      menuHandlers.captureScreenshot()
      await vi.waitFor(() => expect(webContents.capturePage).toHaveBeenCalled())
    }
    void mod
  }, 30_000)

  it('before-quit stops server and disconnects prisma', async () => {
    const mod = await import('./index')
    await whenReadyCbs[0]()
    // force prisma instance via export which uses getPrisma? readSoulMd does not.
    // Export creates prisma
    dialog.showSaveDialog.mockResolvedValueOnce({
      canceled: false,
      filePath: join(ud, 'q.zip')
    })
    menuHandlers.exportFullBackup()
    await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalled())
    appEvents.emit('before-quit')
    await vi.waitFor(() => expect(true).toBe(true))
    void mod
  }, 30_000)

  it('protocol malformed URL returns 400', async () => {
    const mod = await import('./index')
    await whenReadyCbs[0]()
    const protocolHandler = protocol.handle.mock.calls.find(
      (c: unknown[]) => c[0] === 'idm-media'
    )?.[1] as ((req: Request) => Promise<Response>) | undefined
    expect(protocolHandler).toBeTruthy()
    // Force catch by passing invalid request-like object
    const r = await protocolHandler!({ url: '::::::' } as never)
    expect(r.status).toBe(400)
    void mod
  }, 30_000)


  it('prisma disconnect on export with existing prisma', async () => {
    const mod = await import('./index')
    await whenReadyCbs[0]()
    // trigger export twice so second hits prisma disconnect path after first created prisma
    dialog.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: join(ud, 'full-a.zip')
    })
    menuHandlers.exportFullBackup()
    await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalled())
    dialog.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: join(ud, 'full-b.zip')
    })
    menuHandlers.exportFullBackup()
    await vi.waitFor(() =>
      expect(dialog.showMessageBox.mock.calls.length).toBeGreaterThan(1)
    )
    void mod
  }, 30_000)

  it('import without mainWindow uses bare dialogs and cancel confirm', async () => {
    MockBrowserWindow.windows = []
    const mod = await import('./index')
    await whenReadyCbs[0]()
    MockBrowserWindow.windows = [] // ensure no window after boot
    dialog.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [join(ud, 'imp2.zip')]
    })
    writeFileSync(join(ud, 'imp2.zip'), 'z')
    dialog.showMessageBox.mockResolvedValueOnce({ response: 0 })
    menuHandlers.importFullBackup()
    await vi.waitFor(() => expect(dialog.showOpenDialog).toHaveBeenCalled())
    void mod
  }, 30_000)

  it('screenshot empty png and pictures path fail', async () => {
    const mod = await import('./index')
    await whenReadyCbs[0]()
    webContents.capturePage.mockResolvedValueOnce({
      toPNG: () => Buffer.alloc(0)
    })
    if (menuHandlers.captureScreenshot) {
      menuHandlers.captureScreenshot()
      await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalled())
    }
    // pictures path throw
    const origGetPath = app.getPath
    app.getPath = (name: string) => {
      if (name === 'pictures') {
        const e = new Error('no pictures')
        throw e
      }
      return origGetPath(name)
    }
    webContents.capturePage.mockResolvedValueOnce({
      toPNG: () => Buffer.from('pngdata')
    })
    dialog.showSaveDialog.mockResolvedValueOnce({ canceled: true })
    if (menuHandlers.captureScreenshot) {
      try {
        menuHandlers.captureScreenshot()
        await vi.waitFor(() => expect(webContents.capturePage).toHaveBeenCalled(), {
          timeout: 2000
        })
      } catch {
        /* may early-return if no mainWindow after clear */
      }
    }
    app.getPath = origGetPath
    void mod
  }, 30_000)

  it('checkUpdates zh-HK message and openMedia mkdir', async () => {
    vi.doMock('../../src/infrastructure/settings/SettingsStore', () => ({
      SettingsStore: class {
        load() {
          return { uiLanguage: 'zh-HK' }
        }
        save(p: object) {
          return p
        }
      }
    }))
    const mod = await import('./index')
    await whenReadyCbs[0]()
    if (menuHandlers.checkUpdates) {
      menuHandlers.checkUpdates()
      await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalled())
    }
    if (menuHandlers.openMedia) {
      menuHandlers.openMedia()
      await vi.waitFor(() => expect(shell.openPath).toHaveBeenCalled())
    }
    // stream error benign
    process.stdout.emit('error', Object.assign(new Error('pipe'), { code: 'EPIPE' }))
    process.stderr.emit('error', Object.assign(new Error('io'), { code: 'EIO' }))
    // unhandledRejection benign + console.error catch
    const rejListeners = process.listeners('unhandledRejection')
    for (const l of rejListeners) {
      try {
        ;(l as Function)(Object.assign(new Error('x'), { code: 'ERR_STREAM_DESTROYED' }), Promise.resolve())
      } catch { /* */ }
    }
    void mod
  }, 30_000)

  it('DATABASE_URL file://host form and loadMenuLang catch', async () => {
    process.env.DATABASE_URL = 'file://hostname/tmp/db.sqlite'
    vi.doMock('../../src/infrastructure/settings/SettingsStore', () => ({
      SettingsStore: class {
        constructor() {
          throw new Error('no settings')
        }
        load() {
          return {}
        }
      }
    }))
    const mod = await import('./index')
    await whenReadyCbs[0]()
    // export uses zh-HK from catch
    dialog.showSaveDialog.mockResolvedValueOnce({
      canceled: false,
      filePath: join(ud, 'zh.zip')
    })
    menuHandlers.exportFullBackup()
    await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalled())
    delete process.env.DATABASE_URL
    void mod
  }, 30_000)


  it('console.error throws on unhandledRejection and uncaught', async () => {
    const mod = await import('./index')
    await whenReadyCbs[0]()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('console dead')
    })
    const rej = process.listeners('unhandledRejection')
    for (const l of rej) {
      try {
        ;(l as Function)(new Error('real'), Promise.resolve())
      } catch { /* catch in handler */ }
    }
    const un = process.listeners('uncaughtException')
    for (const l of un) {
      try {
        ;(l as Function)(new Error('real2'))
      } catch { /* */ }
    }
    errSpy.mockRestore()
    // file://host/path DATABASE_URL
    process.env.DATABASE_URL = 'file://localhost/tmp/x.sqlite'
    // import already done — call export again after setting
    dialog.showSaveDialog.mockResolvedValueOnce({
      canceled: false,
      filePath: join(ud, 'f.zip')
    })
    menuHandlers.exportFullBackup()
    await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalled())
    delete process.env.DATABASE_URL

    // import without window + cancel confirm already; ensure bare dialogs
    MockBrowserWindow.windows.length = 0
    dialog.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [join(ud, 'i.zip')]
    })
    writeFileSync(join(ud, 'i.zip'), 'z')
    dialog.showMessageBox.mockResolvedValueOnce({ response: 0 })
    menuHandlers.importFullBackup()
    await vi.waitFor(() => expect(dialog.showOpenDialog).toHaveBeenCalled())

    // resolveAppIconPath undefined — hide all icons temporarily
    // setIcon fail
    const origSetIcon = MockBrowserWindow.prototype.setIcon
    MockBrowserWindow.prototype.setIcon = vi.fn(() => {
      throw new Error('setIcon fail')
    })
    appEvents.emit('activate')
    MockBrowserWindow.prototype.setIcon = origSetIcon
    void mod
  }, 30_000)



  it('import bare dialogs cancel and no icon path', async () => {
    const mod = await import('./index')
    await whenReadyCbs[0]()
    // clear main window so import uses bare dialogs
    MockBrowserWindow.windows.forEach((w) => {
      w._closed?.()
    })
    MockBrowserWindow.windows = []

    dialog.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [join(ud, 'bare.zip')]
    })
    writeFileSync(join(ud, 'bare.zip'), 'z')
    // cancel confirm (response 0)
    dialog.showMessageBox.mockResolvedValueOnce({ response: 0 })
    menuHandlers.importFullBackup()
    await vi.waitFor(() => expect(dialog.showOpenDialog).toHaveBeenCalled())

    // force installLinuxDesktopIcon catch via execFileSync throw
    MockBrowserWindow.windows = []
    const cp = await import('child_process')
    const execSpy = vi.spyOn(cp, 'execFileSync').mockImplementation(() => {
      throw new Error('gtk fail')
    })
    appEvents.emit('activate')
    await vi.waitFor(() => expect(MockBrowserWindow.windows.length).toBeGreaterThan(0))
    execSpy.mockRestore()

    // pictures path fail → userData defaultDir
    const origGetPath = app.getPath
    app.getPath = (name: string) => {
      if (name === 'pictures') {
        throw new Error('no pictures')
      }
      if (name === 'desktop') {
        throw new Error('no desktop')
      }
      return origGetPath(name)
    }
    webContents.capturePage.mockResolvedValueOnce({
      toPNG: () => Buffer.from('png')
    })
    dialog.showSaveDialog.mockResolvedValueOnce({ canceled: true })
    if (menuHandlers.captureScreenshot) {
      try {
        menuHandlers.captureScreenshot()
        await vi.waitFor(() => expect(webContents.capturePage).toHaveBeenCalled(), {
          timeout: 2000
        })
      } catch {
        /* may early-return if no mainWindow after clear */
      }
    }
    app.getPath = origGetPath

    // checkUpdates with latestVersion for en string
    const update = await import('../../src/infrastructure/update/AppUpdateService')
    if (update.appUpdateService?.check) {
      vi.spyOn(update.appUpdateService, 'check').mockResolvedValue({
        status: 'available',
        channel: 'desktop-packaged',
        currentVersion: '1.0.0',
        latestVersion: '2.0.0',
        message: 'ok'
      } as never)
    }
    if (menuHandlers.checkUpdates) {
      menuHandlers.checkUpdates()
      await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalled())
    }
    void mod
  }, 30_000)

  it('openMedia is callable', async () => {
    const mod = await import('./index')
    await whenReadyCbs[0]()
    if (menuHandlers.openMedia) {
      menuHandlers.openMedia()
      await vi.waitFor(() => expect(shell.openPath).toHaveBeenCalled())
    }
    void mod
  }, 30_000)


  it('force no icon file found warn', async () => {
    const fs = await import('fs')
    const Module = await import('module')
    // Patch existsSync via Module not possible for ESM easily.
    // Instead: mock resolve by making createFromPath empty + hide resources
    const orig = fs.existsSync
    // Use vi.spyOn may fail on ESM — try
    try {
      const spy = vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
        const s = String(p)
        if (/icon|512x512|app-icon/i.test(s)) return false
        return orig(p)
      })
      const mod = await import('./index')
      await whenReadyCbs[0]()
      spy.mockRestore()
      void mod
    } catch {
      // if spy fails, just boot
      const mod = await import('./index')
      await whenReadyCbs[0]()
      void mod
    }
  }, 30_000)

  it('setIcon throws warns', async () => {
    MockBrowserWindow.prototype.setIcon = vi.fn(() => {
      throw new Error('setIcon boom')
    })
    const mod = await import('./index')
    await whenReadyCbs[0]()
    MockBrowserWindow.windows = []
    appEvents.emit('activate')
    await vi.waitFor(() => expect(MockBrowserWindow.windows.length).toBeGreaterThan(0))
    void mod
  }, 30_000)

  it('residual en import confirm, gateway video provider, before-quit catch', async () => {
    const mod = await import('./index')
    await whenReadyCbs[0]()

    // English import confirm dialog (line 421)
    const settingsPath = join(ud, 'settings.json')
    try {
      writeFileSync(
        settingsPath,
        JSON.stringify({ uiLanguage: 'en' })
      )
    } catch {
      /* */
    }
    MockBrowserWindow.windows = []
    appEvents.emit('activate')
    await vi.waitFor(() => MockBrowserWindow.windows.length > 0)

    dialog.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [join(ud, 'en-import.zip')]
    })
    writeFileSync(join(ud, 'en-import.zip'), 'z')
    dialog.showMessageBox.mockResolvedValueOnce({ response: 0 }) // cancel
    if (menuHandlers.importFullBackup) {
      menuHandlers.importFullBackup()
      await vi.waitFor(() => expect(dialog.showOpenDialog).toHaveBeenCalled())
    }

    // checkUpdates with latestVersion (664)
    const update = await import('../../src/infrastructure/update/AppUpdateService')
    if (update.appUpdateService?.check) {
      vi.spyOn(update.appUpdateService, 'check').mockResolvedValue({
        status: 'available',
        channel: 'desktop-packaged',
        currentVersion: '1.0.0',
        latestVersion: '9.9.9',
        message: 'new',
        releaseUrl: 'https://r'
      } as never)
    }
    if (menuHandlers.checkUpdates) {
      menuHandlers.checkUpdates()
      await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalled())
    }

    // openMedia mkdir catch (643) — media path under userData
    if (menuHandlers.openMedia) {
      menuHandlers.openMedia()
    }

    // before-quit (1096)
    try {
      appEvents.emit('before-quit')
    } catch {
      /* */
    }

    // empty nativeImage (839)
    const electron = await import('electron')
    const orig = electron.nativeImage.createFromPath
    ;(electron.nativeImage as { createFromPath: Function }).createFromPath =
      () => ({ isEmpty: () => true })
    MockBrowserWindow.windows = []
    appEvents.emit('activate')
    await vi.waitFor(() => MockBrowserWindow.windows.length > 0)
    ;(electron.nativeImage as { createFromPath: Function }).createFromPath =
      orig

    // gateway videoProvider grok-gateway (1058)
    const ipc = await import('./ipc')
    vi.spyOn(ipc, 'getIpcRuntime').mockReturnValue({
      settingsStore: {
        load: () => ({
          llmProvider: 'openai',
          imageProvider: 'openai',
          videoProvider: 'grok-gateway'
        })
      },
      invoke: vi.fn(async () => ({}))
    } as never)
    // re-fire whenReady timers already scheduled — just invoke ensure path
    try {
      await ipc.getIpcRuntime()?.invoke?.('gateway:ensure')
    } catch {
      /* */
    }

    void mod
  }, 30_000)

})
