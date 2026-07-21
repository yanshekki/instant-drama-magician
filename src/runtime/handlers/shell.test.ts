import { describe, expect, it, vi, afterEach } from 'vitest'

const execFileShouldFail = vi.hoisted(() => ({ value: false }))
vi.mock('child_process', () => ({
  execFile: (
    cmd: string,
    args: string[],
    optsOrCb?: unknown,
    maybeCb?: (e: Error | null, so: string, se: string) => void
  ) => {
    const cb =
      typeof optsOrCb === 'function'
        ? (optsOrCb as (e: Error | null, so: string, se: string) => void)
        : maybeCb
    if (cb) {
      queueMicrotask(() => {
        if (execFileShouldFail.value) {
          cb(new Error('exec fail'), '', '')
        } else {
          cb(null, '', '')
        }
      })
    }
    return {
      on: vi.fn(),
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() }
    }
  }
}))
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

  it('openExternal falls back when Electron open fails', async () => {
    const { ctx, shell } = ctxWithShell()
    shell.openExternal.mockRejectedValue(new Error('electron fail'))
    registerShellHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, (...a: unknown[]) => unknown> })
      .handlers
    const open = handlers.get('shell:openExternal')!
    // xdg-open may or may not exist; accept either success via fallback or IO error
    try {
      const r = (await open('https://example.com')) as {
        ok: boolean
        via?: string
      }
      expect(r.ok).toBe(true)
      expect(r.via).toBe('fallback')
    } catch (e) {
      expect(e).toMatchObject({ message: 'errors.openUrlFailed' })
    }
    // mailto allowed
    shell.openExternal.mockResolvedValue(undefined)
    await expect(open('mailto:a@b.com')).resolves.toMatchObject({ ok: true })
  })

  it('openPath throws when shell returns error string', async () => {
    const { ctx, shell } = ctxWithShell()
    shell.openPath.mockResolvedValue('ENOENT path')
    registerShellHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, (...a: unknown[]) => unknown> })
      .handlers
    await expect(handlers.get('shell:openPath')!('/missing')).rejects.toMatchObject(
      { message: 'ENOENT path' }
    )
  })

  it('openExternal fallback darwin win32 linux via mocked execFile', async () => {
    const { ctx, shell } = ctxWithShell()
    shell.openExternal.mockRejectedValue(new Error('electron fail'))
    registerShellHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, (...a: unknown[]) => unknown> })
      .handlers
    const open = handlers.get('shell:openExternal')!
    const plat = Object.getOwnPropertyDescriptor(process, 'platform')
    execFileShouldFail.value = false
    for (const platform of ['darwin', 'win32', 'linux'] as const) {
      Object.defineProperty(process, 'platform', {
        value: platform,
        configurable: true
      })
      const r = (await open('https://example.com/x')) as {
        ok: boolean
        via?: string
      }
      expect(r.ok).toBe(true)
      expect(r.via).toBe('fallback')
    }
    if (plat) Object.defineProperty(process, 'platform', plat)
  })

  it('openExternal throws IO when electron and fallback both fail', async () => {
    const { ctx, shell } = ctxWithShell()
    shell.openExternal.mockRejectedValue(new Error('electron fail'))
    execFileShouldFail.value = true
    registerShellHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, (...a: unknown[]) => unknown> })
      .handlers
    const open = handlers.get('shell:openExternal')!
    await expect(open('https://example.com/fail')).rejects.toMatchObject({
      message: 'errors.openUrlFailed',
      code: 'IO'
    })
    // non-Error first rejection still stringifies
    shell.openExternal.mockRejectedValue('bare-string-fail')
    await expect(open('https://example.com/fail2')).rejects.toMatchObject({
      message: 'errors.openUrlFailed'
    })
    execFileShouldFail.value = false
  })

})
