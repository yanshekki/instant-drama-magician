import { describe, expect, it, vi, afterEach } from 'vitest'

describe('getApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('uses window.api when present', async () => {
    const mock = { stories: { list: vi.fn() }, webServer: { start: vi.fn(), generateToken: vi.fn(), status: vi.fn(), stop: vi.fn() } }
    vi.stubGlobal('window', { api: mock })
    const { getApi, isElectron } = await import('./api')
    expect(isElectron()).toBe(true)
    expect(getApi().stories).toBe(mock.stories)
  })

  it('falls back to http client without window.api', async () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => '',
        setItem: () => undefined,
        removeItem: () => undefined
      },
      location: { origin: 'http://localhost' }
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, result: [] }),
      json: async () => ({ ok: true, result: [] })
    }))
    const { getApi, isWebRuntime } = await import('./api')
    expect(isWebRuntime()).toBe(true)
    expect(getApi().stories.list).toBeTypeOf('function')
  })
})
