import { describe, expect, it, vi, afterEach } from 'vitest'

const createLocalClient = vi.fn(async () => ({ mode: 'local' as const }))
const createRemoteClient = vi.fn(() => ({ mode: 'remote' as const }))

vi.mock('./local', () => ({
  createLocalClient: (...a: unknown[]) => createLocalClient(...a)
}))
vi.mock('./remote', () => ({
  createRemoteClient: (...a: unknown[]) => createRemoteClient(...a)
}))

describe('resolveClient', () => {
  afterEach(() => {
    createLocalClient.mockClear()
    createRemoteClient.mockClear()
    vi.resetModules()
  })

  it('uses local when --local or no url', async () => {
    const { resolveClient } = await import('./index')
    await resolveClient({
      json: false,
      pretty: false,
      quiet: false,
      url: null,
      token: null,
      local: false,
      dataDir: '/tmp/d',
      profile: null,
      yes: false,
      help: false
    })
    expect(createLocalClient).toHaveBeenCalledWith({ dataDir: '/tmp/d' })

    createLocalClient.mockClear()
    await resolveClient({
      json: false,
      pretty: false,
      quiet: false,
      url: 'http://x',
      token: 't',
      local: true,
      dataDir: null,
      profile: null,
      yes: false,
      help: false
    })
    expect(createLocalClient).toHaveBeenCalled()
    expect(createRemoteClient).not.toHaveBeenCalled()
  })

  it('uses remote when url set and not --local', async () => {
    const { resolveClient } = await import('./index')
    await resolveClient({
      json: false,
      pretty: false,
      quiet: false,
      url: 'http://127.0.0.1:8787',
      token: 'secret',
      local: false,
      dataDir: null,
      profile: null,
      yes: false,
      help: false
    })
    expect(createRemoteClient).toHaveBeenCalledWith({
      url: 'http://127.0.0.1:8787',
      token: 'secret'
    })
  })
})
