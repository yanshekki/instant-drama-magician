import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const start = vi.fn(async () => ({ url: 'http://127.0.0.1:8787', running: true }))
const stop = vi.fn(async () => ({ running: false }))
const generateWebServerToken = vi.fn(() => 'tok_test')

vi.mock('../../infrastructure/webserver/EmbeddedWebServer', () => ({
  getEmbeddedWebServer: () => ({
    start,
    stop,
    getStatus: () => ({ running: false })
  }),
  generateWebServerToken
}))

import { resolveWebStaticDir, syncEmbeddedWebServer } from './embeddedWebServerSync'

describe('embeddedWebServerSync', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'idm-ws-'))
    start.mockClear()
    stop.mockClear()
    generateWebServerToken.mockClear()
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('resolveWebStaticDir returns a path string', async () => {
    const p = await resolveWebStaticDir()
    expect(typeof p).toBe('string')
  })

  it('stops when webServerEnabled is false', async () => {
    const store = {
      load: vi.fn(() => ({ webServerEnabled: false })),
      save: vi.fn()
    }
    await syncEmbeddedWebServer(
      { webServerEnabled: false } as never,
      {
        settingsStore: store as never,
        userData: dir,
        appVersion: '1.0.0',
        isPackaged: false
      }
    )
    expect(stop).toHaveBeenCalled()
  })

  it('starts with generated token when missing', async () => {
    const store = {
      load: vi.fn(() => ({
        webServerEnabled: true,
        webServerPort: 8787,
        webServerHost: '127.0.0.1',
        webServerAuthToken: 'saved'
      })),
      save: vi.fn(() => ({
        webServerEnabled: true,
        webServerPort: 8787,
        webServerHost: '127.0.0.1',
        webServerAuthToken: 'tok_test'
      }))
    }
    await syncEmbeddedWebServer(
      {
        webServerEnabled: true,
        webServerPort: 8787,
        webServerHost: '127.0.0.1',
        webServerAuthToken: ''
      } as never,
      {
        settingsStore: store as never,
        userData: dir,
        appVersion: '1.0.0',
        isPackaged: false
      }
    )
    expect(generateWebServerToken).toHaveBeenCalled()
    expect(start).toHaveBeenCalled()
  })
})
