import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mockClient, mockExit } from './cliTestUtils'

vi.mock('../client', () => ({
  resolveClient: vi.fn()
}))
vi.mock('../client/remote', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client/remote')>()
  return {
    ...actual,
    createRemoteClient: vi.fn(() =>
      mockClient({
        mode: 'remote',
        channels: vi.fn().mockResolvedValue(['a'])
      })
    ),
    isAuthError: (e: unknown) => String(e).includes('401'),
    isNetworkError: (e: unknown) => String(e).includes('ECONN')
  }
})
vi.mock('./update', () => ({
  probeNpmUpdate: vi.fn(async () => ({
    updateAvailable: false,
    currentVersion: '1.0.0'
  }))
}))

import { resolveClient } from '../client'
import { createRemoteClient } from '../client/remote'
import { cmdDoctor } from './doctor'

describe('cmdDoctor', () => {
  beforeEach(() => {
    mockExit()
    vi.mocked(resolveClient).mockResolvedValue(
      mockClient({
        invoke: vi.fn().mockImplementation(async (ch: string) => {
          if (ch === 'app:getInfo') return { version: '1' }
          if (ch === 'media:checkFfmpeg') return { available: true }
          if (ch === 'ai:status') return { available: true }
          return {}
        })
      }) as never
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('local doctor json and human', async () => {
    await cmdDoctor({
      json: true,
      pretty: true,
      yes: false,
      help: false,
      local: true
    } as never)
    await cmdDoctor({
      json: false,
      pretty: false,
      yes: false,
      help: false,
      local: true
    } as never)
  })

  it('remote health path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: true })
      }))
    )
    await cmdDoctor({
      json: true,
      pretty: false,
      yes: false,
      help: false,
      local: false,
      url: 'http://127.0.0.1:9',
      token: 't'
    } as never)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('down')
      })
    )
    vi.mocked(createRemoteClient).mockReturnValueOnce(
      mockClient({
        channels: vi.fn().mockRejectedValue(new Error('401 unauthorized'))
      }) as never
    )
    await expect(
      cmdDoctor({
        json: true,
        pretty: false,
        yes: false,
        help: false,
        local: false,
        url: 'http://x'
      } as never)
    ).rejects.toThrow(/process.exit/)
  })

  it('local probe handles appInfo/ffmpeg failures and skip update', async () => {
    process.env.IDM_SKIP_UPDATE = '1'
    vi.mocked(resolveClient).mockResolvedValue(
      mockClient({
        invoke: vi.fn().mockImplementation(async (ch: string) => {
          if (ch === 'app:getInfo') throw new Error('no info')
          if (ch === 'media:checkFfmpeg') throw new Error('no ff')
          return {}
        }),
        describe: () => ({ mode: 'local', dataDir: '/d' })
      }) as never
    )
    await cmdDoctor({
      json: false,
      pretty: false,
      yes: false,
      help: false,
      local: true
    } as never)
    delete process.env.IDM_SKIP_UPDATE
  })

  it('local client creation failure marks report not ok', async () => {
    vi.mocked(resolveClient).mockRejectedValueOnce(new Error('boot fail'))
    await expect(
      cmdDoctor({
        json: true,
        pretty: false,
        yes: false,
        help: false,
        local: true
      } as never)
    ).rejects.toThrow(/process.exit/)
  })

  it('remote network error exits CONNECT', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: true })
      }))
    )
    vi.mocked(createRemoteClient).mockReturnValueOnce(
      mockClient({
        channels: vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
      }) as never
    )
    await expect(
      cmdDoctor({
        json: true,
        pretty: false,
        yes: false,
        help: false,
        local: false,
        url: 'http://x'
      } as never)
    ).rejects.toThrow(/process.exit/)
  })
})
