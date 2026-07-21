import { describe, expect, it, vi, afterEach } from 'vitest'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerGatewayHandlers } from './gateway'

const gwMod = await import('../../infrastructure/gateway/GrokGatewayService')

describe('registerGatewayHandlers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerGatewayHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('ai:probeVideo')).toBe(true)
    expect(handlers.has('ai:probeChat')).toBe(true)
    expect(handlers.has('ai:listModels')).toBe(true)
  })

  it('gateway status/ensure/installHints/openAdmin', async () => {
    const status = {
      state: 'running',
      healthOk: true,
      grokPath: '/g',
      gctoacPath: '/c',
      adminUrl: 'http://127.0.0.1:8181'
    }
    const gw = {
      getStatus: vi.fn(async () => status),
      ensureRunningWithApiKey: vi.fn(async () => ({
        status,
        apiKey: 'sk-test',
        keyCreated: true
      })),
      ensureRunning: vi.fn(async () => status),
      baseUrl: 'http://127.0.0.1:8080',
      adminUrl: 'http://127.0.0.1:8181'
    }
    vi.spyOn(gwMod, 'getGrokGatewayService').mockReturnValue(gw as never)
    vi.spyOn(gwMod.GrokGatewayService, 'grokBuildInstallUrl').mockReturnValue('http://i')
    vi.spyOn(gwMod.GrokGatewayService, 'gatewayDocsUrl').mockReturnValue('http://d')
    vi.spyOn(gwMod.GrokGatewayService, 'grokBuildInstallCommand').mockReturnValue('cmd')

    const save = vi.fn((p: unknown) => ({
      llmProvider: 'grok-gateway',
      baseUrl: 'http://127.0.0.1:8080',
      apiKey: 'sk-test',
      ...(p as object)
    }))
    const load = vi.fn(() => ({
      llmProvider: 'grok-gateway',
      apiKey: '',
      baseUrl: ''
    }))
    const rebindAi = vi.fn()
    const append = vi.fn()
    const openExternal = vi.fn(async () => undefined)
    const openAdminWindow = vi.fn(async (url: string) => ({
      ok: true as const,
      url,
      reused: true
    }))

    const ctx = makeHandlerContext({
      settingsStore: { load, save, lastLoadMigrated: false } as never,
      rebindAi,
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
        openAdminWindow,
        shell: {
          openExternal,
          openPath: vi.fn(),
          showItemInFolder: vi.fn()
        }
      } as never
    })
    registerGatewayHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await expect(invokeRegistered(h as never, 'gateway:status')).resolves.toMatchObject({
      state: 'running'
    })
    const ensured = (await invokeRegistered(h as never, 'gateway:ensure')) as {
      keyReady: boolean
    }
    expect(ensured.keyReady).toBe(true)
    expect(rebindAi).toHaveBeenCalled()
    expect(append).toHaveBeenCalled()

    await expect(invokeRegistered(h as never, 'gateway:installHints')).resolves.toMatchObject({
      installCommand: 'cmd'
    })

    await expect(invokeRegistered(h as never, 'gateway:openAdmin')).resolves.toMatchObject({
      ok: true,
      reused: true
    })
    expect(openAdminWindow).toHaveBeenCalled()

    // without openAdminWindow → openExternal
    const ctx2 = makeHandlerContext({
      settingsStore: { load, save, lastLoadMigrated: false } as never,
      rebindAi,
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
        shell: {
          openExternal,
          openPath: vi.fn(),
          showItemInFolder: vi.fn()
        }
      } as never
    })
    registerGatewayHandlers(ctx2)
    const h2 = (ctx2 as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h2 as never, 'gateway:openAdmin', 'http://custom')
    ).resolves.toMatchObject({ via: 'external', url: 'http://custom' })
  })

  it('ai probe/list/test/presets', async () => {
    const probe = vi.fn(async () => ({ id: 'v', available: true, message: 'ok' }))
    const probeChat = vi.fn(async () => ({ ok: true }))
    const listModels = vi.fn(async () => [{ id: 'm1' }])
    const testChat = vi.fn(async () => ({ ok: true, reply: 'hi' }))
    const save = vi.fn((p: unknown) => ({
      llmProvider: 'openai-compatible',
      baseUrl: 'http://x',
      videoPath: '/v',
      model: 'm',
      ...(p as object)
    }))
    const load = vi.fn(() => ({
      llmProvider: 'custom',
      baseUrl: 'http://old',
      videoPath: '',
      model: ''
    }))
    const rebindAi = vi.fn()
    const append = vi.fn()
    const ensureRunning = vi.fn(async () => ({}))
    vi.spyOn(gwMod, 'getGrokGatewayService').mockReturnValue({
      ensureRunning
    } as never)

    const ctx = makeHandlerContext({
      aiClient: {
        videoProvider: { probe },
        probeChat,
        listModels,
        testChat
      },
      settingsStore: { load, save, lastLoadMigrated: false } as never,
      rebindAi,
      activity: {
        append,
        readRecent: vi.fn(),
        query: vi.fn(),
        clear: vi.fn(),
        kinds: vi.fn(),
        path: '/l'
      } as never
    })
    registerGatewayHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await invokeRegistered(h as never, 'ai:probeVideo')
    await invokeRegistered(h as never, 'ai:probeChat')
    await invokeRegistered(h as never, 'ai:listModels')
    await invokeRegistered(h as never, 'ai:testChat', 'hello')
    expect(testChat).toHaveBeenCalledWith('hello')

    await invokeRegistered(h as never, 'ai:applyLlmPreset', 'openai')
    expect(rebindAi).toHaveBeenCalled()
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('llm preset') })
    )

    await invokeRegistered(h as never, 'ai:applyLlmPreset', 'grok-gateway')
    // fire-and-forget ensureRunning
    await new Promise((r) => setTimeout(r, 20))

    await invokeRegistered(h as never, 'ai:applyGrokDefaults')
    expect(save).toHaveBeenCalled()
  })
})
