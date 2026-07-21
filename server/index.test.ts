import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const start = vi.fn()
const stop = vi.fn().mockResolvedValue(undefined)
const migrate = vi.fn().mockReturnValue({ actions: ['moved-db'] })

vi.mock('../src/infrastructure/webserver/EmbeddedWebServer', () => ({
  EmbeddedWebServer: class {
    start = start
    stop = stop
  }
}))

vi.mock('../src/application/services/AppDataMigrationService', () => ({
  migrateAppDataIfNeeded: (...a: unknown[]) => migrate(...a)
}))

vi.mock('../src/domain/appPaths', () => ({
  resolveAppPaths: () => ({
    dataRoot: '/tmp/idm-server-test-data',
    databaseUrl: 'file:/tmp/idm-server-test-data/db.sqlite',
    databasePath: '/tmp/idm-server-test-data/db.sqlite'
  })
}))

describe('server entry', () => {
  let listeners: Array<{ ev: string; fn: (...a: unknown[]) => void }> = []
  let onSpy: ReturnType<typeof vi.spyOn> | null = null
  let exitSpy: ReturnType<typeof vi.spyOn> | null = null

  beforeEach(() => {
    start.mockReset()
    stop.mockReset().mockResolvedValue(undefined)
    migrate.mockReset().mockReturnValue({ actions: ['moved-db'] })
    start.mockResolvedValue({
      url: 'http://0.0.0.0:8787',
      staticReady: true,
      authDisabled: true,
      authRequired: false,
      channels: 12
    })
    vi.stubEnv('IDM_PORT', '8799')
    vi.stubEnv('IDM_HOST', '127.0.0.1')
    vi.stubEnv('IDM_AUTH_DISABLED', '1')
    vi.stubEnv('IDM_AUTH_TOKEN', '')
    delete process.env.DATABASE_URL
    listeners = []
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never)
    onSpy = vi.spyOn(process, 'on').mockImplementation(((
      ev: string,
      fn: (...a: unknown[]) => void
    ) => {
      listeners.push({ ev, fn })
      return process
    }) as never)
    vi.resetModules()
  })

  afterEach(() => {
    for (const l of listeners) {
      try {
        process.removeListener(l.ev, l.fn)
      } catch {
        /* ignore */
      }
    }
    listeners = []
    onSpy?.mockRestore()
    exitSpy?.mockRestore()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('starts EmbeddedWebServer and wires shutdown', async () => {
    await import('./index')
    await vi.waitFor(() => expect(start).toHaveBeenCalled())
    expect(start.mock.calls[0][0]).toMatchObject({
      port: 8799,
      host: '127.0.0.1',
      authDisabled: true
    })
    expect(process.env.DATABASE_URL).toContain('file:')

    const sigint = listeners.find((c) => c.ev === 'SIGINT')
    expect(sigint).toBeTruthy()
    stop.mockResolvedValue(undefined)
    sigint!.fn()
    await vi.waitFor(() => expect(stop).toHaveBeenCalled())
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('survives migration failure', async () => {
    migrate.mockImplementation(() => {
      throw new Error('mig fail')
    })
    await import('./index')
    await vi.waitFor(() => expect(start).toHaveBeenCalled())
  })

  it('exits on start failure', async () => {
    start.mockRejectedValueOnce(new Error('bind fail'))
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await import('./index')
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(1))
    err.mockRestore()
  })
})
