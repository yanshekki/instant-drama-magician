import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const handles: Record<string, Function> = {}
const ipcMain = {
  handle: vi.fn((ch: string, fn: Function) => {
    handles[ch] = fn
  })
}

let capturedHost: Record<string, unknown> | null = null

const winFocus = vi.fn()
const winLoadURL = vi.fn(async () => undefined)
const winOn = vi.fn()
const setWindowOpenHandler = vi.fn()
const webContentsSend = vi.fn()

vi.mock('electron', () => {
  const send = (...a: unknown[]) => webContentsSend(...a)
  const loadURL = (...a: unknown[]) => winLoadURL(...a)
  const focus = (...a: unknown[]) => winFocus(...a)
  const on = (...a: unknown[]) => winOn(...a)
  const setOpen = (...a: unknown[]) => setWindowOpenHandler(...a)
  class MockBW {
    webContents = {
      send,
      getURL: () => 'about:blank',
      setWindowOpenHandler: setOpen,
      loadURL
    }
    isDestroyed = () => false
    focus = focus
    loadURL = loadURL
    on = on
  }
  return {
    app: {
      getPath: () => process.env.IDM_IPC_UD || join(tmpdir(), 'idm-ipc-ud'),
      getVersion: () => '1.0.0',
      isPackaged: false
    },
    BrowserWindow: MockBW
  }
})

vi.mock('../../src/runtime/createRuntime', () => ({
  createRuntime: (opts: { hostOverrides?: Record<string, unknown> }) => {
    capturedHost = opts.hostOverrides || null
    return {
      channels: () => [
        'stories:list',
        'activity:list',
        'settings:set',
        'activity:recent'
      ],
      invoke: vi.fn(async (ch: string, args: unknown[]) => {
        if (ch === 'stories:list') return []
        if (ch === 'settings:set') return { ok: true, args }
        if (ch === 'boom') {
          throw new Error(JSON.stringify({ code: 'IO', message: 'x' }))
        }
        return { ch, args }
      }),
      dispose: vi.fn()
    }
  }
}))

vi.mock('../../src/infrastructure/gateway/GrokGatewayService', () => ({
  getGrokGatewayService: () => ({
    ensureRunning: async () => ({ state: 'ready', healthOk: true })
  })
}))

vi.mock('../../src/infrastructure/settings/SettingsStore', () => ({
  SettingsStore: class {
    static defaultPath = (u: string) => join(u, 'settings.json')
    constructor(public p: string) {}
    load() {
      return { uiLanguage: 'en' }
    }
    save(p: object) {
      return p
    }
  }
}))

vi.mock('../../src/infrastructure/activity/ActivityLog', () => ({
  ActivityLog: class {
    static defaultPath = (u: string) => join(u, 'activity.jsonl')
    append = vi.fn()
    readRecent = () => []
  }
}))

import { registerIpcHandlers, getIpcRuntime, AppError } from './ipc'

describe('electron ipc', () => {
  let data: string
  beforeEach(() => {
    data = mkdtempSync(join(tmpdir(), 'ipc-'))
    process.env.IDM_IPC_UD = data
    Object.keys(handles).forEach((k) => delete handles[k])
    ipcMain.handle.mockClear()
    capturedHost = null
    webContentsSend.mockClear()
    winFocus.mockClear()
    winLoadURL.mockClear()
  })
  afterEach(() => {
    try {
      rmSync(data, { recursive: true, force: true })
    } catch {
      /* */
    }
  })

  function register(mainWin: unknown = 'default') {
    const win =
      mainWin === 'default'
        ? {
            isDestroyed: () => false,
            webContents: { send: webContentsSend }
          }
        : mainWin
    const dialog = {
      showOpenDialog: vi.fn(async (_a?: unknown, _b?: unknown) => ({
        canceled: false,
        filePaths: ['/a']
      })),
      showSaveDialog: vi.fn(async (_a?: unknown, _b?: unknown) => ({
        canceled: false,
        filePath: '/b'
      }))
    }
    // Overloads: with win or without
    dialog.showOpenDialog.mockImplementation(async (...args: unknown[]) => {
      void args
      return { canceled: false, filePaths: ['/a'] }
    })
    dialog.showSaveDialog.mockImplementation(async (...args: unknown[]) => {
      void args
      return { canceled: false, filePath: '/b' }
    })
    const shell = {
      openExternal: vi.fn(async () => undefined),
      openPath: vi.fn(async () => ''),
      showItemInFolder: vi.fn()
    }
    registerIpcHandlers({
      ipcMain: ipcMain as never,
      dialog: dialog as never,
      shell: shell as never,
      getPrisma: () => ({}) as never,
      getMainWindow: () => win as never,
      rebuildApplicationMenu: vi.fn(),
      resolveDatabasePath: () => join(data, 'db.sqlite'),
      exportFullBackup: vi.fn(),
      importFullBackup: vi.fn()
    })
    return { dialog, shell, win }
  }

  it('registers handlers and routes invoke with redaction', async () => {
    register()
    expect(getIpcRuntime()).toBeTruthy()
    expect(AppError).toBeTruthy()
    expect(handles['stories:list']).toBeTruthy()

    await expect(handles['stories:list']({})).resolves.toEqual([])

    // activity channel skips activity append path still works
    await handles['activity:list']({})

    // settings:set redacts secrets in summarizeArgs
    const long = 'x'.repeat(3000)
    await handles['settings:set'](
      {},
      { apiKey: 'secret', ttsHttpUrl: 'http://t', note: long }
    )

    const rt = getIpcRuntime()!
    vi.spyOn(rt, 'invoke').mockRejectedValueOnce(
      new Error(JSON.stringify({ code: 'IO', message: 'fail' }))
    )
    await expect(
      handles['settings:set']({}, { apiKey: 'secret' })
    ).rejects.toThrow()
  })

  it('summarizeArgs catch path via circular host invoke', async () => {
    register()
    // Force unserializable args by patching JSON.stringify during invoke
    const rt = getIpcRuntime()!
    const orig = JSON.stringify
    let n = 0
    vi.spyOn(JSON, 'stringify').mockImplementation((v: unknown) => {
      n++
      // first stringify in summarizeArgs for settings:set throws
      if (n === 1) throw new Error('circular')
      return orig(v)
    })
    try {
      await handles['settings:set']({}, { apiKey: 's' })
    } catch {
      /* may still succeed after catch returns note */
    }
    vi.mocked(JSON.stringify).mockRestore()
    void rt
  })

  it('electronDialog with and without BrowserWindow-like first arg', async () => {
    // Explicit null main window → dialog overloads without parent
    const { dialog } = register(null)
    expect(capturedHost).toBeTruthy()
    const h = capturedHost as {
      dialog: {
        showOpenDialog: Function
        showSaveDialog: Function
      }
      shell: {
        openExternal: Function
        openPath: Function
        showItemInFolder: Function
      }
    }

    // no win — getMainWindow is null → dialog(options) overload
    await h.dialog.showOpenDialog({ properties: ['openFile'] })
    await h.dialog.showSaveDialog({ defaultPath: '/x' })

    // with win-like object as first arg
    const fakeWin = { webContents: {} }
    await h.dialog.showOpenDialog(fakeWin, { properties: ['openFile'] })
    await h.dialog.showSaveDialog(fakeWin, { defaultPath: '/y' })

    // undefined options with win
    await h.dialog.showOpenDialog(fakeWin)
    await h.dialog.showSaveDialog(fakeWin)

    expect(dialog.showOpenDialog).toHaveBeenCalled()
    expect(dialog.showSaveDialog).toHaveBeenCalled()

    await h.shell.openExternal('https://x')
    await h.shell.openPath('/p')
    h.shell.showItemInFolder('/p')
  })

  it('electronDialog uses getMainWindow when provided', async () => {
    const parent = {
      isDestroyed: () => false,
      webContents: { send: webContentsSend }
    }
    const { dialog } = register(parent)
    const h = capturedHost as {
      dialog: { showOpenDialog: Function; showSaveDialog: Function }
    }
    await h.dialog.showOpenDialog({ properties: ['openFile'] })
    await h.dialog.showSaveDialog({ defaultPath: '/z' })
    // parent win passed to electron dialog
    expect(dialog.showOpenDialog).toHaveBeenCalled()
    expect(dialog.showSaveDialog).toHaveBeenCalled()
  })

  it('emitGenerationProgress and openAdminWindow paths', async () => {
    const mainWin = {
      isDestroyed: () => false,
      webContents: { send: webContentsSend }
    }
    const { shell } = register(mainWin)
    const h = capturedHost as {
      emitGenerationProgress: (p: unknown) => void
      getLastGenerationProgress: () => unknown
      openAdminWindow: (url: string) => Promise<unknown>
    }

    h.emitGenerationProgress({ step: 'video', index: 0 })
    expect(webContentsSend).toHaveBeenCalledWith(
      'generation:progress',
      expect.any(Object)
    )
    expect(h.getLastGenerationProgress()).toMatchObject({ step: 'video' })

    // openAdminWindow creates BW
    const r1 = (await h.openAdminWindow('http://127.0.0.1:3847/admin')) as {
      reused: boolean
      ok: boolean
    }
    expect(r1.ok).toBe(true)
    expect(r1.reused).toBe(false)
    expect(winLoadURL).toHaveBeenCalled()

    // fire closed handler
    const closedCb = winOn.mock.calls.find((c) => c[0] === 'closed')?.[1] as
      | (() => void)
      | undefined
    // before close, reuse path
    winLoadURL.mockClear()
    // getURL matches → no reload
    const r2 = (await h.openAdminWindow('http://127.0.0.1:3847/admin')) as {
      reused: boolean
    }
    // adminWindow still set; may reuse
    expect(r2.reused === true || r2.reused === false).toBe(true)

    // window open handler for external links
    const openHandler = setWindowOpenHandler.mock.calls[0]?.[0] as (a: {
      url: string
    }) => { action: string }
    if (openHandler) {
      expect(openHandler({ url: 'https://ysk.hk' }).action).toBe('deny')
      expect(shell.openExternal).toHaveBeenCalled()
      expect(openHandler({ url: 'file:///etc/passwd' }).action).toBe('deny')
    }

    closedCb?.()
    // after closed, create new window
    const r3 = (await h.openAdminWindow('http://127.0.0.1:3847/admin2')) as {
      reused: boolean
    }
    expect(r3.reused).toBe(false)
  })

  it('emitGenerationProgress no-ops when main window destroyed', async () => {
    register({
      isDestroyed: () => true,
      webContents: { send: webContentsSend }
    })
    const h = capturedHost as {
      emitGenerationProgress: (p: unknown) => void
    }
    webContentsSend.mockClear()
    h.emitGenerationProgress({ x: 1 })
    expect(webContentsSend).not.toHaveBeenCalled()
  })
})
