import { describe, expect, it, vi, afterEach } from 'vitest'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerWebserverHandlers } from './webServer'
import * as emb from '../../infrastructure/webserver/EmbeddedWebServer'
import * as syncMod from './embeddedWebServerSync'
import { AppError } from '../../types/errors'

describe('registerWebserverHandlers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('status/start/stop/generateToken paths', async () => {
    const getStatus = vi.fn(() => ({ running: false, port: 0 }))
    const stop = vi.fn(async () => ({ running: false }))
    vi.spyOn(emb, 'getEmbeddedWebServer').mockReturnValue({
      getStatus,
      stop
    } as never)
    vi.spyOn(emb, 'generateWebServerToken').mockReturnValue('tok-abc')
    const sync = vi
      .spyOn(syncMod, 'syncEmbeddedWebServer')
      .mockResolvedValueOnce({ running: true, port: 8787 } as never)
      .mockRejectedValueOnce(new AppError('IO', 'boom'))
      .mockRejectedValueOnce(new Error('plain'))
      .mockResolvedValueOnce({ running: true, port: 8787 } as never)

    const save = vi.fn((p: unknown) => ({
      webServerEnabled: false,
      webServerAuthToken: '',
      ...(p as object)
    }))
    const load = vi.fn(() => ({
      webServerEnabled: false,
      webServerAuthToken: ''
    }))
    const ctx = makeHandlerContext({
      settingsStore: { load, save, lastLoadMigrated: false } as never
    })
    registerWebserverHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await expect(invokeRegistered(h as never, 'webServer:status')).resolves.toMatchObject({
      running: false
    })

    await expect(invokeRegistered(h as never, 'webServer:start')).resolves.toMatchObject({
      running: true
    })
    expect(save).toHaveBeenCalledWith({ webServerEnabled: true })

    await expect(invokeRegistered(h as never, 'webServer:start')).rejects.toMatchObject({
      message: 'boom'
    })
    await expect(invokeRegistered(h as never, 'webServer:start')).rejects.toMatchObject({
      code: 'IO'
    })

    await expect(invokeRegistered(h as never, 'webServer:stop')).resolves.toMatchObject({
      running: false
    })
    expect(save).toHaveBeenCalledWith({ webServerEnabled: false })

    // generateToken when disabled
    save.mockImplementation((p: unknown) => ({
      webServerEnabled: false,
      webServerAuthToken: 'tok-abc',
      ...(p as object)
    }))
    await expect(
      invokeRegistered(h as never, 'webServer:generateToken')
    ).resolves.toMatchObject({ token: 'tok-abc' })

    // generateToken when enabled → sync
    save.mockImplementation((p: unknown) => ({
      webServerEnabled: true,
      webServerAuthToken: 'tok-abc',
      ...(p as object)
    }))
    await invokeRegistered(h as never, 'webServer:generateToken')
    expect(sync).toHaveBeenCalled()
  })
})
