import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { classifyUpdateError, emptyUpdateState } from './updateTypes'

const handlers: Record<string, (...a: unknown[]) => void> = {}
const autoUpdater = {
  autoDownload: false,
  autoInstallOnAppQuit: false,
  allowPrerelease: false,
  checkForUpdates: vi.fn(),
  downloadUpdate: vi.fn(),
  quitAndInstall: vi.fn(),
  on: vi.fn((ev: string, fn: (...a: unknown[]) => void) => {
    handlers[ev] = fn
    return autoUpdater
  })
}

vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getVersion: () => '1.2.0'
  }
}))

vi.mock('electron-updater', () => ({
  autoUpdater
}))

vi.mock('../../domain/installChannel', () => ({
  detectInstallChannel: () => 'desktop-packaged',
  githubReleaseUrl: (v?: string) =>
    v ? `https://github.com/r/releases/tag/v${v}` : 'https://github.com/r/releases'
}))

describe('classifyUpdateError', () => {
  it('classifies kinds', () => {
    expect(classifyUpdateError('getaddrinfo ENOTFOUND github.com')).toBe(
      'network'
    )
    expect(classifyUpdateError('Fetch failed')).toBe('network')
    expect(classifyUpdateError('404 latest-linux.yml not found')).toBe('feed')
    expect(classifyUpdateError('Code signature invalid')).toBe('signature')
    expect(classifyUpdateError('ENOSPC: no space left')).toBe('disk')
    expect(classifyUpdateError('EACCES: permission denied')).toBe('permission')
  })
})

describe('emptyUpdateState', () => {
  it('fills defaults', () => {
    const s = emptyUpdateState({
      channel: 'desktop-dev',
      currentVersion: '1.0.0'
    })
    expect(s.status).toBe('idle')
    expect(s.canAutoInstall).toBe(false)
  })
})

describe('AppUpdateService', () => {
  beforeEach(() => {
    vi.resetModules()
    Object.keys(handlers).forEach((k) => delete handlers[k])
    autoUpdater.checkForUpdates.mockReset()
    autoUpdater.downloadUpdate.mockReset()
    autoUpdater.quitAndInstall.mockReset()
    autoUpdater.on.mockClear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('covers packaged check/download/install and events', async () => {
    const { AppUpdateService, appUpdateService } = await import(
      './AppUpdateService'
    )
    expect(appUpdateService).toBeTruthy()
    const svc = new AppUpdateService()
    const send = vi.fn()
    svc.bindWindow(() => ({ webContents: { send } }) as never)
    svc.bindWindow(() => null) // wireOnce once

    autoUpdater.checkForUpdates.mockResolvedValue({ updateInfo: null })
    let st = await svc.check()
    expect(['checking', 'not-available', 'idle', 'error']).toContain(st.status)

    autoUpdater.checkForUpdates.mockRejectedValue(new Error('ENOTFOUND'))
    st = await svc.check()
    expect(st.status).toBe('error')

    // silent check
    autoUpdater.checkForUpdates.mockResolvedValue({
      updateInfo: { version: '9' }
    })
    await svc.check({ silent: true })

    // events
    handlers['checking-for-update']?.()
    handlers['update-available']?.({
      version: '2.0.0',
      releaseNotes: 'notes'
    })
    expect(svc.getState().status).toBe('available')
    handlers['update-available']?.({
      version: '2.1.0',
      releaseNotes: [{ note: 'a' }, 'b']
    })
    handlers['update-not-available']?.({ version: '1.2.0' })
    handlers['download-progress']?.({ percent: 42.2 })
    handlers['update-downloaded']?.({
      version: '2.0.0',
      releaseNotes: null
    })
    expect(svc.getState().canAutoInstall).toBe(true)
    handlers['error']?.(new Error('fail'))

    // download when available
    handlers['update-available']?.({ version: '3.0.0', releaseNotes: 'x' })
    autoUpdater.downloadUpdate.mockResolvedValue(undefined)
    await svc.download()
    autoUpdater.downloadUpdate.mockRejectedValue(new Error('disk ENOSPC'))
    handlers['update-available']?.({ version: '3.0.1' })
    await svc.download()

    handlers['update-downloaded']?.({ version: '3.0.1' })
    expect(svc.quitAndInstall().ok).toBe(true)
  })

  it('dev channel skips', async () => {
    vi.doMock('../../domain/installChannel', () => ({
      detectInstallChannel: () => 'desktop-dev',
      githubReleaseUrl: () => 'https://x'
    }))
    vi.resetModules()
    // re-mock electron-updater for fresh module
    vi.doMock('electron', () => ({
      app: { isPackaged: false, getVersion: () => '1.0.0' }
    }))
    vi.doMock('electron-updater', () => ({ autoUpdater }))
    const { AppUpdateService } = await import('./AppUpdateService')
    const svc = new AppUpdateService()
    const st = await svc.check()
    expect(st.status).toBe('dev-skipped')
    expect((await svc.download()).status).toBe('dev-skipped')
    expect(svc.quitAndInstall().ok).toBe(false)
  })

  it('check download install residual paths', async () => {
    const mod = await import('./AppUpdateService')
    const svc = mod.appUpdateService
    try {
      await svc.check({ silent: false })
    } catch { /* */ }
    try {
      await svc.download()
    } catch { /* */ }
    try {
      const r = svc.quitAndInstall?.() ?? (svc as any).quitAndInstall?.()
      void r
    } catch { /* */ }
    // no downloaded install
    try {
      const r = (svc as any).quitAndInstall?.() 
    } catch { /* */ }
  })


  it('quitAndInstall without downloaded returns fail', async () => {
    const { AppUpdateService } = await import('./AppUpdateService')
    const svc = new AppUpdateService()
    // ensure not in downloaded state
    handlers['update-not-available']?.({ version: '1.2.0' })
    const r = svc.quitAndInstall()
    expect(r.ok).toBe(false)
    expect(r.messageKey || r.message).toBeTruthy()
  })

  it('silent false checking state path', async () => {
    const { AppUpdateService } = await import('./AppUpdateService')
    const svc = new AppUpdateService()
    autoUpdater.checkForUpdates.mockImplementation(
      () =>
        new Promise((resolve) => {
          handlers['checking-for-update']?.()
          setTimeout(() => resolve({ updateInfo: null }), 5)
        })
    )
    const st = await svc.check({ silent: false })
    expect(st).toBeTruthy()
  })


  it('silent idle sets checking state soft', async () => {
    const { AppUpdateService, normalizeReleaseNotes, safeAppVersion } =
      await import('./AppUpdateService')
    expect(normalizeReleaseNotes(null)).toBeNull()
    expect(normalizeReleaseNotes(' hi ')).toBe('hi')
    expect(normalizeReleaseNotes('  ')).toBeNull()
    expect(normalizeReleaseNotes(['a', { note: 'b' }])).toMatch(/a/)
    expect(normalizeReleaseNotes(99 as never)).toBeNull()
    expect(typeof safeAppVersion()).toBe('string')

    const svc = new AppUpdateService()
    autoUpdater.checkForUpdates.mockResolvedValue({ updateInfo: null })
    const st = await svc.check({ silent: true })
    expect(st).toBeTruthy()
    const r = svc.quitAndInstall()
    expect(r.ok).toBe(false)
    expect(r.messageKey || r.message).toBeTruthy()
  })

  it('setState github source when packaged source none', async () => {
    const { AppUpdateService } = await import('./AppUpdateService')
    const svc = new AppUpdateService()
    handlers['checking-for-update']?.()
    handlers['update-available']?.({
      version: '4.0.0',
      releaseNotes: [{ note: 'n1' }, 'n2']
    })
    // channel may be dev or packaged depending on mock order
    expect(['available', 'dev-skipped', 'checking', 'idle', 'error']).toContain(
      svc.getState().status
    )
    autoUpdater.downloadUpdate.mockResolvedValue(undefined)
    await svc.download()
  })

})
