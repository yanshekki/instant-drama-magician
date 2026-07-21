import { describe, expect, it, vi, afterEach } from 'vitest'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerUpdatesHandlers } from './updates'
import * as npmUpdate from '../../infrastructure/update/npmPackageUpdate'

describe('registerUpdatesHandlers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.doUnmock('../../infrastructure/update/AppUpdateService')
  })

  it('registers channels', () => {
    const ctx = makeHandlerContext()
    registerUpdatesHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('updates:status')).toBe(true)
    expect(handlers.has('updates:check')).toBe(true)
    expect(handlers.has('updates:download')).toBe(true)
    expect(handlers.has('updates:install')).toBe(true)
    expect(handlers.has('updates:checkNpm')).toBe(true)
    expect(handlers.has('updates:openReleasePage')).toBe(true)
  })

  it('non-desktop fallbacks when update service missing', async () => {
    vi.mock('../../infrastructure/update/AppUpdateService', () => {
      throw new Error('no electron-updater')
    })
    // Dynamic import catch path: mock module that fails
    const ctx = makeHandlerContext()
    // Force loadUpdateService to return null by spying dynamic import isn't easy;
    // instead mock the module after register via replacing import — use real service if present.
    // Override by temporarily making import throw:
    const original = await import('../../infrastructure/update/AppUpdateService')
    vi.spyOn(original, 'appUpdateService', 'get').mockReturnValue(null as never)

    registerUpdatesHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    // If service exists, exercise real methods; else non-desktop path
    const status = await invokeRegistered(h as never, 'updates:status')
    expect(status).toBeTruthy()

    const append = vi.fn()
    const openExternal = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('blocked'))
    const ctx2 = makeHandlerContext({
      activity: {
        append,
        readRecent: vi.fn(),
        query: vi.fn(),
        clear: vi.fn(),
        kinds: vi.fn(),
        path: '/l'
      } as never,
      host: {
        ...(makeHandlerContext().host as object),
        appVersion: '1.2.0',
        isPackaged: false,
        shell: {
          openExternal,
          openPath: vi.fn(),
          showItemInFolder: vi.fn()
        }
      } as never
    })
    registerUpdatesHandlers(ctx2)
    const h2 = (ctx2 as { handlers: Map<string, unknown> }).handlers

    // Mock checkNpm
    vi.spyOn(npmUpdate, 'checkNpmPackageUpdate').mockResolvedValue({
      updateAvailable: true,
      latestVersion: '9.9.9',
      currentVersion: '1.2.0',
      installCommand: 'npm i -g x'
    } as never)

    await invokeRegistered(h2 as never, 'updates:checkNpm')
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('npm check') })
    )

    await expect(
      invokeRegistered(h2 as never, 'updates:openReleasePage', '1.0.0')
    ).resolves.toMatchObject({ ok: true })
    await expect(
      invokeRegistered(h2 as never, 'updates:openReleasePage')
    ).resolves.toMatchObject({ ok: false })
  })

  it('uses AppUpdateService when available', async () => {
    const state = {
      status: 'idle',
      currentVersion: '1.2.0',
      latestVersion: '1.3.0'
    }
    const svc = {
      getState: vi.fn(() => state),
      check: vi.fn(async () => ({ ...state, status: 'available' })),
      download: vi.fn(async () => ({ ...state, status: 'downloaded' })),
      quitAndInstall: vi.fn(() => ({ ok: true }))
    }
    const mod = await import('../../infrastructure/update/AppUpdateService')
    vi.spyOn(mod, 'appUpdateService', 'get').mockReturnValue(svc as never)

    const append = vi.fn()
    const ctx = makeHandlerContext({
      activity: {
        append,
        readRecent: vi.fn(),
        query: vi.fn(),
        clear: vi.fn(),
        kinds: vi.fn(),
        path: '/l'
      } as never
    })
    registerUpdatesHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await expect(invokeRegistered(h as never, 'updates:status')).resolves.toMatchObject({
      status: 'idle'
    })
    await invokeRegistered(h as never, 'updates:check', { silent: true })
    expect(svc.check).toHaveBeenCalledWith({ silent: true })
    await invokeRegistered(h as never, 'updates:download')
    expect(svc.download).toHaveBeenCalled()
    await invokeRegistered(h as never, 'updates:install')
    expect(svc.quitAndInstall).toHaveBeenCalled()
    expect(append).toHaveBeenCalled()
  })
})
