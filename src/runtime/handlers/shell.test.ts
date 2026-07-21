import { describe, expect, it, vi } from 'vitest'
import { makeHandlerContext } from '../../test/handlerTestUtils'
import { registerShellHandlers } from './shell'

describe('registerShellHandlers', () => {
  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerShellHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('shell:openExternal')).toBe(true)
    expect(handlers.has('shell:openPath')).toBe(true)
    expect(handlers.has('shell:showItemInFolder')).toBe(true)
  })

  function ctxWithShell() {
    const shell = {
      openExternal: vi.fn(async () => undefined),
      openPath: vi.fn(async () => ''),
      showItemInFolder: vi.fn()
    }
    const ctx = makeHandlerContext({
      host: {
        mode: 'headless',
        userData: '/tmp/idm-test',
        mediaRoot: '/tmp/idm-test/media',
        appVersion: 'test',
        isPackaged: false,
        platform: 'linux',
        getPrisma: vi.fn(),
        settingsStore: { load: vi.fn(() => ({})), save: vi.fn(), lastLoadMigrated: false },
        activity: { append: vi.fn() },
        dialog: {},
        shell,
        getMainWindow: () => null
      } as never
    })
    return { ctx, shell }
  }

  it('openExternal validates url protocol', async () => {
    const { ctx, shell } = ctxWithShell()
    registerShellHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, (...a: unknown[]) => unknown> })
      .handlers
    const open = handlers.get('shell:openExternal')!
    await expect(open('')).rejects.toMatchObject({
      message: 'errors.urlRequired'
    })
    await expect(open('not a url')).rejects.toMatchObject({
      message: 'errors.invalidUrl'
    })
    await expect(open('file:///tmp/x')).rejects.toMatchObject({
      message: 'errors.unsupportedUrlProtocol'
    })
    const r = await open('https://example.com/path')
    expect(r).toMatchObject({ ok: true, url: 'https://example.com/path' })
    expect(shell.openExternal).toHaveBeenCalled()
  })

  it('openPath throws IO when shell returns error string', async () => {
    const { ctx, shell } = ctxWithShell()
    shell.openPath.mockResolvedValue('ENOENT')
    registerShellHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, (...a: unknown[]) => unknown> })
      .handlers
    await expect(handlers.get('shell:openPath')!('/x')).rejects.toMatchObject({
      code: 'IO'
    })
    shell.openPath.mockResolvedValue('')
    await expect(handlers.get('shell:openPath')!('/x')).resolves.toEqual({
      ok: true
    })
  })

  it('showItemInFolder returns ok', async () => {
    const { ctx, shell } = ctxWithShell()
    registerShellHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, (...a: unknown[]) => unknown> })
      .handlers
    await expect(
      handlers.get('shell:showItemInFolder')!('/tmp/a.png')
    ).resolves.toEqual({ ok: true })
    expect(shell.showItemInFolder).toHaveBeenCalledWith('/tmp/a.png')
  })
})
