import { describe, expect, it, vi, beforeEach } from 'vitest'

const setApplicationMenu = vi.fn()
const buildFromTemplate = vi.fn((t) => t)
const send = vi.fn()
const getFocusedWindow = vi.fn()
const getAllWindows = vi.fn()
const openExternal = vi.fn()

vi.mock('electron', () => ({
  BrowserWindow: {
    getFocusedWindow: () => getFocusedWindow(),
    getAllWindows: () => getAllWindows()
  },
  Menu: {
    buildFromTemplate: (t: unknown) => buildFromTemplate(t),
    setApplicationMenu: (m: unknown) => setApplicationMenu(m)
  },
  shell: { openExternal: (...a: unknown[]) => openExternal(...a) }
}))

import {
  buildAppMenuTemplate,
  coerceMenuLang,
  installAppMenu,
  sendMenuActionToRenderer,
  type AppMenuHandlers
} from './appMenu'

function handlers(): AppMenuHandlers {
  return {
    sendAction: vi.fn(),
    showAbout: vi.fn(),
    exportFullBackup: vi.fn(),
    importFullBackup: vi.fn(),
    openUserData: vi.fn(),
    openMedia: vi.fn(),
    exportSupportReport: vi.fn(),
    checkUpdates: vi.fn(),
    captureScreenshot: vi.fn(),
    isDev: true
  }
}

function walkClicks(items: unknown[], depth = 0): void {
  if (depth > 6 || !Array.isArray(items)) return
  for (const raw of items) {
    const it = raw as {
      click?: () => void
      submenu?: unknown[]
    }
    if (typeof it.click === 'function') {
      try {
        it.click()
      } catch {
        /* */
      }
    }
    if (it.submenu) walkClicks(it.submenu as unknown[], depth + 1)
  }
}

describe('appMenu', () => {
  beforeEach(() => {
    setApplicationMenu.mockClear()
    buildFromTemplate.mockClear()
    send.mockClear()
    getFocusedWindow.mockReturnValue(null)
    getAllWindows.mockReturnValue([])
  })

  it('coerceMenuLang', () => {
    expect(coerceMenuLang(null)).toBe('zh-HK')
    expect(coerceMenuLang('en-US')).toBe('en')
    expect(coerceMenuLang('zh-CN')).toBe('zh-HK')
    expect(coerceMenuLang('ja')).toBe('en')
  })

  it('builds templates and fires clicks (en + zh, dev)', () => {
    const h = handlers()
    const en = buildAppMenuTemplate('en', h)
    const zh = buildAppMenuTemplate('zh-HK', { ...h, isDev: false })
    expect(en.length).toBeGreaterThan(0)
    walkClicks(en)
    walkClicks(zh)
    expect(h.sendAction).toHaveBeenCalled()
    expect(h.exportFullBackup).toHaveBeenCalled()
    expect(openExternal).toHaveBeenCalled()
  })

  it('installAppMenu and sendMenuActionToRenderer', () => {
    installAppMenu('en', handlers())
    expect(setApplicationMenu).toHaveBeenCalled()

    sendMenuActionToRenderer({ type: 'about' })
    getFocusedWindow.mockReturnValue({
      isDestroyed: () => false,
      webContents: { send }
    })
    sendMenuActionToRenderer({ type: 'navigate', path: '/' })
    expect(send).toHaveBeenCalled()

    getFocusedWindow.mockReturnValue(null)
    getAllWindows.mockReturnValue([
      { isDestroyed: () => true, webContents: { send } }
    ])
    sendMenuActionToRenderer({ type: 'about' })
  })
})

// darwin branch
describe('appMenu mac template', () => {
  it('includes app menu on darwin', async () => {
    const original = process.platform
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    vi.resetModules()
    vi.doMock('electron', () => ({
      BrowserWindow: {
        getFocusedWindow: () => null,
        getAllWindows: () => []
      },
      Menu: {
        buildFromTemplate: (t: unknown) => t,
        setApplicationMenu: vi.fn()
      },
      shell: { openExternal: vi.fn() }
    }))
    const mod = await import('./appMenu')
    const t = mod.buildAppMenuTemplate('en', {
      sendAction: vi.fn(),
      showAbout: vi.fn(),
      exportFullBackup: vi.fn(),
      importFullBackup: vi.fn(),
      openUserData: vi.fn(),
      openMedia: vi.fn(),
      exportSupportReport: vi.fn(),
      checkUpdates: vi.fn(),
      captureScreenshot: vi.fn(),
      isDev: false
    })
    expect(t[0]?.label).toBeTruthy()
    walkClicks(t)
    Object.defineProperty(process, 'platform', { value: original })
  })
})
