import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mockExit } from './cliTestUtils'

const start = vi.fn()
const stop = vi.fn().mockResolvedValue(undefined)

vi.mock('../../infrastructure/webserver/EmbeddedWebServer', () => ({
  EmbeddedWebServer: class {
    start = start
    stop = stop
  }
}))

import { cmdServer } from './server'

describe('cmdServer', () => {
  beforeEach(() => {
    mockExit()
    start.mockReset()
    stop.mockReset().mockResolvedValue(undefined)
    start.mockResolvedValue({
      url: 'http://0.0.0.0:8787',
      staticReady: true,
      authDisabled: true,
      authRequired: false,
      channels: 3
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('rejects non-start', async () => {
    await expect(
      cmdServer({ json: true } as never, ['stop'], {})
    ).rejects.toThrow(/process.exit/)
  })

  it('starts and handles signals', async () => {
    const listeners: Array<{ ev: string | symbol; fn: (...a: unknown[]) => void }> =
      []
    const on = vi.spyOn(process, 'on').mockImplementation(((
      ev: string | symbol,
      fn: (...a: unknown[]) => void
    ) => {
      listeners.push({ ev, fn })
      return process
    }) as never)
    // mockExit throws on process.exit — re-stub for this test so shutdown can finish
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
    void cmdServer(
      { json: true, pretty: true, dataDir: '/tmp/idm-s' } as never,
      ['start'],
      { port: '8991', host: '127.0.0.1', authDisabled: true }
    )
    await vi.waitFor(() => expect(start).toHaveBeenCalled())
    const sig = listeners.find((c) => c.ev === 'SIGINT')
    expect(sig).toBeTruthy()
    stop.mockResolvedValue(undefined)
    sig!.fn()
    await vi.waitFor(() => expect(stop).toHaveBeenCalled())
    expect(exit).toHaveBeenCalled()
    for (const l of listeners) {
      try {
        process.off(l.ev as NodeJS.Signals, l.fn as never)
      } catch {
        /* ignore */
      }
    }
    on.mockRestore()
  })

  it('start failure exits', async () => {
    start.mockRejectedValueOnce(new Error('bind fail'))
    await expect(
      cmdServer(
        { json: true, pretty: false, dataDir: '/tmp/idm-s2' } as never,
        ['start'],
        { port: '8992' }
      )
    ).rejects.toThrow(/bind fail|process\.exit/)
  })

  it('human mode and token generation path', async () => {
    const listeners: Array<{ ev: string | symbol; fn: (...a: unknown[]) => void }> =
      []
    vi.spyOn(process, 'on').mockImplementation(((
      ev: string | symbol,
      fn: (...a: unknown[]) => void
    ) => {
      listeners.push({ ev, fn })
      return process
    }) as never)
    vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
    start.mockResolvedValue({
      url: 'http://127.0.0.1:8787',
      staticReady: false,
      authDisabled: false,
      authRequired: true,
      channels: 10,
      authToken: 'tok'
    })
    void cmdServer(
      {
        json: false,
        pretty: false,
        dataDir: '/tmp/idm-s3',
        token: 'pre'
      } as never,
      [],
      { host: '0.0.0.0' }
    )
    await vi.waitFor(() => expect(start).toHaveBeenCalled())
    const sig = listeners.find((c) => c.ev === 'SIGTERM')
    if (sig) sig.fn()
  })
})
