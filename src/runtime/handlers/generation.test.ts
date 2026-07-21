import { describe, expect, it, vi } from 'vitest'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerGenerationHandlers } from './generation'

describe('registerGenerationHandlers', () => {
  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerGenerationHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('generation:run')).toBe(true)
    expect(handlers.has('generation:cancel')).toBe(true)
    expect(handlers.has('generation:progress')).toBe(true)
    expect(handlers.has('generation:runClip')).toBe(true)
    expect(handlers.has('ai:status')).toBe(true)
  })

  it('run pipeline appends activity and saves degraded flag', async () => {
    const run = vi.fn(async () => ({
      success: true,
      steps: [{ name: 'a', degraded: true }]
    }))
    const append = vi.fn()
    const save = vi.fn((p: object) => p)
    const emit = vi.fn()
    const ctx = makeHandlerContext({
      generation: () =>
        ({
          run,
          cancel: vi.fn(),
          rebindAi: vi.fn(),
          generateClip: vi.fn(),
          getMediaStore: () => ({})
        }) as never,
      activity: {
        append,
        readRecent: vi.fn(),
        query: vi.fn(),
        clear: vi.fn(),
        kinds: vi.fn(),
        path: '/l'
      } as never,
      settingsStore: {
        load: vi.fn(() => ({})),
        save,
        lastLoadMigrated: false
      } as never,
      host: {
        mode: 'headless',
        userData: '/tmp/u',
        mediaRoot: '/tmp/m',
        appVersion: '1',
        isPackaged: false,
        platform: 'linux',
        getPrisma: vi.fn(),
        settingsStore: { load: vi.fn(), save: vi.fn() },
        activity: { append },
        dialog: {},
        shell: {},
        getMainWindow: () => null,
        emitGenerationProgress: emit,
        getLastGenerationProgress: vi.fn(() => ({ step: 1 }))
      } as never
    })
    registerGenerationHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    const result = await invokeRegistered(h as never, 'generation:run', 's1', {
      onlyFailedVideos: true
    })
    expect(run).toHaveBeenCalled()
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'retry failed' })
    )
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'pipeline ok' })
    )
    expect(save).toHaveBeenCalledWith({ lastGenerationDegraded: true })
    expect(result).toMatchObject({ success: true })

    // progress callback invoked during run
    const progressCb = run.mock.calls[0][1] as (p: unknown) => void
    progressCb({ step: 'x' })
    expect(emit).toHaveBeenCalledWith({ step: 'x' })
  })

  it('cancel / progress / runClip / ai:status', async () => {
    const cancel = vi.fn()
    const generateClip = vi.fn(async () => ({
      path: '/c.mp4',
      degraded: false
    }))
    const append = vi.fn()
    const getLast = vi.fn(() => ({ pct: 50 }))
    const getStatus = vi.fn(async () => ({ available: true }))
    const ctx = makeHandlerContext({
      generation: () =>
        ({
          cancel,
          generateClip,
          run: vi.fn(),
          rebindAi: vi.fn(),
          getMediaStore: () => ({})
        }) as never,
      activity: {
        append,
        readRecent: vi.fn(),
        query: vi.fn(),
        clear: vi.fn(),
        kinds: vi.fn(),
        path: '/l'
      } as never,
      host: {
        mode: 'headless',
        userData: '/tmp/u',
        mediaRoot: '/tmp/m',
        appVersion: '1',
        isPackaged: false,
        platform: 'linux',
        getPrisma: vi.fn(),
        settingsStore: { load: vi.fn(), save: vi.fn() },
        activity: { append },
        dialog: {},
        shell: {},
        getMainWindow: () => null,
        getLastGenerationProgress: getLast,
        emitGenerationProgress: vi.fn()
      } as never
    })
    // override aiClient via Object.defineProperty on returned ctx is hard;
    // ai:status uses ctx.aiClient from getter on makeHandlerContext default
    registerGenerationHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await expect(
      invokeRegistered(h as never, 'generation:cancel')
    ).resolves.toEqual({ ok: true })
    expect(cancel).toHaveBeenCalled()

    await expect(
      invokeRegistered(h as never, 'generation:progress')
    ).resolves.toEqual({ pct: 50 })

    await invokeRegistered(h as never, 'generation:runClip', 's1', 'e1', {
      revisionPrompt: 'darker'
    })
    expect(generateClip).toHaveBeenCalled()
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'run clip' })
    )

    const st = await invokeRegistered(h as never, 'ai:status')
    expect(st).toMatchObject({ available: true })
    void getStatus
  })
})
