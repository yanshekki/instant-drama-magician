/**
 * Packaged-channel residual: silent idle soft-check, download pre-check,
 * quitAndInstall not-downloaded, setState source none→github.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

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

describe('AppUpdateService packaged residuals', () => {
  beforeEach(() => {
    vi.resetModules()
    Object.keys(handlers).forEach((k) => delete handlers[k])
    autoUpdater.checkForUpdates.mockReset()
    autoUpdater.downloadUpdate.mockReset()
    autoUpdater.quitAndInstall.mockReset()
    autoUpdater.on.mockClear()
  })
  afterEach(() => vi.restoreAllMocks())

  it('silent idle soft checking, download calls check, quit not downloaded', async () => {
    const { AppUpdateService } = await import('./AppUpdateService')
    const svc = new AppUpdateService()
    svc.bindWindow(() => null)
    // status is idle
    expect(svc.getState().status).toBe('idle')

    autoUpdater.checkForUpdates.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ updateInfo: null }), 15)
        })
    )
    // silent + idle → lines 104-111
    const st = await svc.check({ silent: true })
    expect(st).toBeTruthy()

    // download when not available → check first (159-160)
    const svc2 = new AppUpdateService()
    autoUpdater.checkForUpdates.mockImplementation(async () => {
      handlers['update-available']?.({ version: '2.0.0', releaseNotes: 'n' })
      return { updateInfo: { version: '2.0.0' } }
    })
    autoUpdater.downloadUpdate.mockResolvedValue(undefined)
    await svc2.download()

    // quit without downloaded (196-201)
    const svc3 = new AppUpdateService()
    handlers['update-available']?.({ version: '3.0.0' })
    // ensure packaged channel state
    const r = svc3.quitAndInstall()
    expect(r.ok).toBe(false)
    expect(r.messageKey).toBe('updateInstallFail')

    // setState source none → github (300) via download-progress (no source partial)
    const svc4 = new AppUpdateService()
    svc4.bindWindow(() => null)
    expect(svc4.getState().channel).toBe('desktop-packaged')
    ;(svc4 as unknown as { state: { source: string; status: string } }).state.source =
      'none'
    ;(svc4 as unknown as { state: { source: string; status: string } }).state.status =
      'available'
    handlers['download-progress']?.({ percent: 42 })
    expect(svc4.getState().source).toBe('github')
    expect(svc4.getState().status).toBe('downloading')
  })
})
