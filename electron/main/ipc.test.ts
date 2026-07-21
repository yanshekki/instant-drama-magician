import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const handles: Record<string, Function> = {}
const ipcMain = {
  handle: vi.fn((ch: string, fn: Function) => {
    handles[ch] = fn
  })
}

vi.mock('electron', () => ({
  app: {
    getPath: () => join(tmpdir(), 'idm-ipc-ud'),
    getVersion: () => '1.0.0',
    isPackaged: false
  },
  BrowserWindow: class {
    webContents = {
      send: vi.fn(),
      getURL: () => 'about:blank',
      setWindowOpenHandler: vi.fn()
    }
    isDestroyed = () => false
    focus = vi.fn()
    loadURL = vi.fn(async () => undefined)
    on = vi.fn()
    constructor() {
      /* */
    }
  }
}))

vi.mock('../../src/runtime/createRuntime', () => ({
  createRuntime: () => ({
    channels: () => ['stories:list', 'activity:list', 'settings:set'],
    invoke: vi.fn(async (ch: string, args: unknown[]) => {
      if (ch === 'stories:list') return []
      if (ch === 'boom') throw new Error(JSON.stringify({ code: 'IO', message: 'x' }))
      return { ch, args }
    }),
    dispose: vi.fn()
  })
}))

vi.mock('../../src/infrastructure/gateway/GrokGatewayService', () => ({
  getGrokGatewayService: () => ({
    ensureRunning: async () => ({ state: 'ready', healthOk: true })
  })
}))

import { registerIpcHandlers, getIpcRuntime, AppError } from './ipc'

describe('electron ipc', () => {
  let data: string
  beforeEach(() => {
    data = mkdtempSync(join(tmpdir(), 'ipc-'))
    Object.keys(handles).forEach((k) => delete handles[k])
    ipcMain.handle.mockClear()
  })
  afterEach(() => {
    try {
      rmSync(data, { recursive: true, force: true })
    } catch {
      /* */
    }
  })

  it('registers handlers and routes invoke', async () => {
    const win = {
      isDestroyed: () => false,
      webContents: { send: vi.fn() }
    }
    const dialog = {
      showOpenDialog: vi.fn(async () => ({
        canceled: false,
        filePaths: ['/a']
      })),
      showSaveDialog: vi.fn(async () => ({
        canceled: false,
        filePath: '/b'
      }))
    }
    const shell = {
      openExternal: vi.fn(),
      openPath: vi.fn(),
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

    expect(getIpcRuntime()).toBeTruthy()
    expect(AppError).toBeTruthy()
    expect(handles['stories:list']).toBeTruthy()

    await handles['stories:list']({}, )
    await expect(handles['stories:list']({})).resolves.toEqual([])

    // error path via custom channel not registered — use invoke through runtime
    // register only listed channels; force error by temporarily patching
    const rt = getIpcRuntime()!
    vi.spyOn(rt, 'invoke').mockRejectedValueOnce(
      new Error(JSON.stringify({ code: 'IO', message: 'fail' }))
    )
    // re-get handler for settings:set which redacts
    await expect(handles['settings:set']({}, { apiKey: 'secret', ttsHttpUrl: 'http://t' })).rejects.toThrow()

    // dialog with window and without
    // openAdminWindow via hostOverrides — need a channel that calls it; skip if none
  })
})
