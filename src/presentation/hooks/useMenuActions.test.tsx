import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { createMockApi } from '../../test/mockApi'
import {
  MENU_IMPORT_STORY_EVENT,
  MENU_NEW_STORY_EVENT
} from './useMenuActions'

const api = createMockApi()
const isElectron = vi.fn(() => true)

vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isElectron: () => isElectron()
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, string>) =>
      opts ? `${k}:${JSON.stringify(opts)}` : k,
    i18n: { language: 'en' }
  })
}))

const openLegalDocument = vi.fn()
vi.mock('../components/LegalDocumentModal', () => ({
  openLegalDocument: (...args: unknown[]) => openLegalDocument(...args)
}))

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  show: vi.fn(),
  dismiss: vi.fn(),
  toasts: []
}
const dialog = {
  confirm: vi.fn().mockResolvedValue(true),
  alert: vi.fn().mockResolvedValue(undefined)
}
const app = {
  stories: [],
  activeStoryId: 's1' as string | null,
  setActiveStoryId: vi.fn(),
  refreshStories: vi.fn().mockResolvedValue(undefined),
  aiStatus: null,
  refreshAiStatus: vi.fn(),
  loading: false
}

vi.mock('../context/AppContext', () => ({
  useApp: () => app
}))
vi.mock('../context/ToastContext', () => ({
  useToast: () => toast
}))
vi.mock('../context/DialogContext', () => ({
  useDialog: () => dialog
}))

import { useMenuActions } from './useMenuActions'

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

describe('useMenuActions', () => {
  let menuHandler: ((action: unknown) => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    isElectron.mockReturnValue(true)
    app.activeStoryId = 's1'
    dialog.confirm.mockResolvedValue(true)
    menuHandler = null
    api.app.onMenuAction = vi.fn((cb: (a: unknown) => void) => {
      menuHandler = cb
      return () => {
        menuHandler = null
      }
    })
    api.project.exportBackup = vi.fn().mockResolvedValue({
      filePath: '/tmp/b.zip',
      fileName: 'b.zip'
    })
    api.app.exportFullBackup = vi.fn().mockResolvedValue({
      filePath: '/tmp/full.zip',
      fileName: 'full.zip'
    })
    api.app.importFullBackup = vi.fn().mockResolvedValue({ ok: true })
    api.support.exportReport = vi.fn().mockResolvedValue({
      filePath: '/tmp/support.zip'
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('no-ops when not electron', () => {
    isElectron.mockReturnValue(false)
    renderHook(() => useMenuActions(), { wrapper })
    expect(api.app.onMenuAction).not.toHaveBeenCalled()
  })

  it('subscribes and unsubscribes on mount/unmount', () => {
    const unsub = vi.fn()
    api.app.onMenuAction = vi.fn(() => unsub)
    const { unmount } = renderHook(() => useMenuActions(), { wrapper })
    expect(api.app.onMenuAction).toHaveBeenCalled()
    unmount()
    expect(unsub).toHaveBeenCalled()
  })

  it('handles onMenuAction throw', () => {
    api.app.onMenuAction = vi.fn(() => {
      throw new Error('no bridge')
    })
    expect(() =>
      renderHook(() => useMenuActions(), { wrapper })
    ).not.toThrow()
  })

  async function fire(action: unknown): Promise<void> {
    renderHook(() => useMenuActions(), { wrapper })
    expect(menuHandler).toBeTruthy()
    await act(async () => {
      await menuHandler!(action)
    })
  }

  it('navigate and preferences', async () => {
    await fire({ type: 'navigate', path: '/characters' })
    await fire({ type: 'preferences' })
  })

  it('new-story and import-story dispatch events', async () => {
    const newSpy = vi.fn()
    const impSpy = vi.fn()
    window.addEventListener(MENU_NEW_STORY_EVENT, newSpy)
    window.addEventListener(MENU_IMPORT_STORY_EVENT, impSpy)

    await fire({ type: 'new-story' })
    await act(async () => {
      vi.advanceTimersByTime(60)
    })
    expect(newSpy).toHaveBeenCalled()

    await fire({ type: 'import-story' })
    await act(async () => {
      vi.advanceTimersByTime(60)
      vi.advanceTimersByTime(2000)
    })
    expect(impSpy).toHaveBeenCalled()
    expect(app.refreshStories).toHaveBeenCalled()

    window.removeEventListener(MENU_NEW_STORY_EVENT, newSpy)
    window.removeEventListener(MENU_IMPORT_STORY_EVENT, impSpy)
  })

  it('export-story without active story toasts error', async () => {
    app.activeStoryId = null
    await fire({ type: 'export-story' })
    expect(toast.error).toHaveBeenCalled()
    expect(api.project.exportBackup).not.toHaveBeenCalled()
  })

  it('export-story cancel does nothing', async () => {
    dialog.confirm.mockResolvedValueOnce(false)
    await fire({ type: 'export-story' })
    expect(api.project.exportBackup).not.toHaveBeenCalled()
  })

  it('export-story success and error', async () => {
    await fire({ type: 'export-story' })
    expect(api.project.exportBackup).toHaveBeenCalledWith('s1')
    expect(toast.success).toHaveBeenCalled()

    api.project.exportBackup = vi.fn().mockRejectedValue(new Error('fail'))
    await fire({ type: 'export-story' })
    expect(toast.error).toHaveBeenCalled()
  })

  it('export-story with downloadUrl only', async () => {
    api.project.exportBackup = vi.fn().mockResolvedValue({
      downloadUrl: '/dl/x'
    })
    await fire({ type: 'export-story' })
    expect(toast.success).toHaveBeenCalled()
  })

  it('export-full success and error', async () => {
    await fire({ type: 'export-full' })
    expect(toast.success).toHaveBeenCalled()
    api.app.exportFullBackup = vi.fn().mockRejectedValue(new Error('e'))
    await fire({ type: 'export-full' })
    expect(toast.error).toHaveBeenCalled()
  })

  it('import-full success and error', async () => {
    await fire({ type: 'import-full' })
    expect(toast.success).toHaveBeenCalled()
    api.app.importFullBackup = vi.fn().mockRejectedValue(new Error('e'))
    await fire({ type: 'import-full' })
    expect(toast.error).toHaveBeenCalled()
  })

  it('export-support success and error', async () => {
    await fire({ type: 'export-support' })
    expect(toast.success).toHaveBeenCalled()
    api.support.exportReport = vi.fn().mockRejectedValue(new Error('e'))
    await fire({ type: 'export-support' })
    expect(toast.error).toHaveBeenCalled()
  })

  it('export-support without filePath skips toast', async () => {
    api.support.exportReport = vi.fn().mockResolvedValue({})
    await fire({ type: 'export-support' })
  })

  it('full-backup-exported and screenshot-saved toasts', async () => {
    await fire({ type: 'full-backup-exported', filePath: '/x' })
    await fire({ type: 'screenshot-saved', filePath: '/y' })
    expect(toast.success).toHaveBeenCalledTimes(2)
  })

  it('open-legal terms and disclaimer', async () => {
    await fire({ type: 'open-legal', kind: 'terms' })
    expect(openLegalDocument).toHaveBeenCalledWith('terms')
    await fire({ type: 'open-legal', kind: 'disclaimer' })
    expect(openLegalDocument).toHaveBeenCalledWith('disclaimer')
  })

  it('main-handled actions and default are no-ops', async () => {
    for (const type of [
      'open-user-data',
      'open-media',
      'about',
      'check-updates',
      'unknown-type'
    ]) {
      await fire({ type })
    }
  })
})
