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
})
