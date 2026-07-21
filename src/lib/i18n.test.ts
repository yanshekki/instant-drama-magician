import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

describe('i18n module', () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('exports i18n and changeUiLanguage', async () => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
      removeItem: (k: string) => {
        delete store[k]
      }
    })
    vi.stubGlobal('document', {
      documentElement: { lang: '', dir: '', setAttribute: vi.fn() }
    })
    const mod = await import('./i18n')
    expect(mod.default).toBeTruthy()
    const code = await mod.changeUiLanguage('en')
    expect(code).toBe('en')
    // same language short-circuit
    const again = await mod.changeUiLanguage('en')
    expect(again).toBe('en')
    const zh = await mod.changeUiLanguage('zh-HK')
    expect(zh).toBe('zh-HK')
  })
})
