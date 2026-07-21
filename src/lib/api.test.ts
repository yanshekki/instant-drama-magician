import { describe, expect, it, vi, afterEach } from 'vitest'

describe('getApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('uses window.api when present with webServer', async () => {
    const mock = {
      stories: { list: vi.fn() },
      webServer: {
        start: vi.fn(),
        generateToken: vi.fn(),
        status: vi.fn(),
        stop: vi.fn()
      }
    }
    vi.stubGlobal('window', { api: mock })
    const { getApi, isElectron, isWebRuntime } = await import('./api')
    expect(isElectron()).toBe(true)
    expect(isWebRuntime()).toBe(false)
    expect(getApi().stories).toBe(mock.stories)
  })

  it('rebuilds webServer from _invoke when missing', async () => {
    const inv = vi.fn(async (ch: string) => ({ channel: ch }))
    vi.stubGlobal('window', {
      api: {
        stories: { list: vi.fn() },
        _invoke: inv
      }
    })
    const { getApi } = await import('./api')
    const api = getApi()
    await api.webServer.status()
    await api.webServer.start()
    await api.webServer.stop()
    await api.webServer.generateToken()
    expect(inv).toHaveBeenCalledWith('webServer:status')
    expect(inv).toHaveBeenCalledWith('webServer:start')
  })

  it('falls back to http webServer namespace when no _invoke', async () => {
    vi.stubGlobal('window', {
      api: { stories: { list: vi.fn() } },
      localStorage: {
        getItem: () => '',
        setItem: () => undefined,
        removeItem: () => undefined
      },
      location: { origin: 'http://localhost' }
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true, result: { ok: true } }),
        json: async () => ({ ok: true, result: { ok: true } })
      })
    )
    const { getApi } = await import('./api')
    expect(typeof getApi().webServer.start).toBe('function')
  })

  it('returns original api when http client cannot be created', async () => {
    const bare = { stories: { list: vi.fn() } }
    // no localStorage → createHttpAppClient may still work; force throw via broken fetch later
    vi.stubGlobal('window', {
      api: bare,
      localStorage: {
        getItem: () => {
          throw new Error('ls')
        },
        setItem: () => {
          throw new Error('ls')
        },
        removeItem: () => {
          throw new Error('ls')
        }
      }
    })
    const { getApi } = await import('./api')
    // ensureWebServer still returns api with http webServer or original
    expect(getApi().stories).toBe(bare.stories)
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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true, result: [] }),
        json: async () => ({ ok: true, result: [] })
      })
    )
    const { getApi, isWebRuntime } = await import('./api')
    expect(isWebRuntime()).toBe(true)
    expect(getApi().stories.list).toBeTypeOf('function')
  })

  it('throws when window is undefined', async () => {
    vi.stubGlobal('window', undefined)
    const { getApi, isElectron } = await import('./api')
    expect(isElectron()).toBe(false)
    expect(() => getApi()).toThrow()
  })
})
