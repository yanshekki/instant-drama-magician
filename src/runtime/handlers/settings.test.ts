import { describe, expect, it, vi } from 'vitest'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerSettingsHandlers } from './settings'

describe('registerSettingsHandlers', () => {
  it('registers settings channels', () => {
    const ctx = makeHandlerContext()
    registerSettingsHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('settings:get')).toBe(true)
    expect(handlers.has('settings:set')).toBe(true)
  })

  it('settings:get returns store and logs migration once', async () => {
    const append = vi.fn()
    const store = {
      load: vi.fn(() => ({ uiLanguage: 'en' })),
      save: vi.fn(),
      lastLoadMigrated: true
    }
    const ctx = makeHandlerContext({
      settingsStore: store as never,
      activity: { append, readRecent: vi.fn(), query: vi.fn(), clear: vi.fn(), kinds: vi.fn(), path: '/l' } as never
    })
    registerSettingsHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    const s = await invokeRegistered(handlers as never, 'settings:get')
    expect(s).toMatchObject({ uiLanguage: 'en' })
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'settings', message: expect.stringMatching(/39281/) })
    )
    expect(store.lastLoadMigrated).toBe(false)
  })

  it('settings:set saves, rebinds AI, rebuilds menu on language change', async () => {
    const rebindAi = vi.fn()
    const rebuildApplicationMenu = vi.fn()
    const store = {
      load: vi.fn(() => ({
        uiLanguage: 'zh-HK',
        llmProvider: 'openai',
        webServerEnabled: false
      })),
      save: vi.fn((p: object) => ({
        uiLanguage: 'en',
        llmProvider: 'openai',
        webServerEnabled: false,
        ...p
      })),
      lastLoadMigrated: false
    }
    const ctx = makeHandlerContext({
      settingsStore: store as never,
      rebindAi,
      host: {
        mode: 'electron',
        userData: '/tmp/u',
        mediaRoot: '/tmp/m',
        appVersion: '1',
        isPackaged: false,
        platform: 'linux',
        getPrisma: vi.fn(),
        settingsStore: store,
        activity: { append: vi.fn() },
        dialog: {},
        shell: {},
        getMainWindow: () => null,
        rebuildApplicationMenu
      } as never
    })
    registerSettingsHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    const next = await invokeRegistered(handlers as never, 'settings:set', {
      uiLanguage: 'en'
    })
    expect(store.save).toHaveBeenCalled()
    expect(rebindAi).toHaveBeenCalled()
    expect(rebuildApplicationMenu).toHaveBeenCalled()
    expect(next).toMatchObject({ uiLanguage: 'en' })
  })
})
