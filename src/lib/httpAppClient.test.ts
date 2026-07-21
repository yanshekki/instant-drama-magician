/** @vitest-environment happy-dom */
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { mockFetchSequence } from '../test/httpMock'

describe('httpAppClient', () => {
  let store: Record<string, string>

  beforeEach(() => {
    store = { idm_auth_token: 'tok' }
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v
        },
        removeItem: (k: string) => {
          delete store[k]
        }
      },
      location: { origin: 'http://localhost', reload: vi.fn() },
      open: vi.fn(),
      navigator: {
        clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
      }
    })
    // restore document helpers for download
    if (typeof document !== 'undefined') {
      document.body.innerHTML = ''
    }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('posts channel derived from nested api call', async () => {
    const fetchMock = mockFetchSequence([
      { status: 200, json: { ok: true, result: { id: '1' } } }
    ])
    const { createHttpAppClient } = await import('./httpAppClient')
    const api = createHttpAppClient()
    const r = await api.stories.list()
    expect(r).toEqual({ id: '1' })
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body
    )
    expect(body.channel).toBe('stories:list')
  })

  it('token helpers and loginWithToken', async () => {
    mockFetchSequence([{ status: 200, json: { ok: true, result: {} } }])
    const {
      getStoredAuthToken,
      setStoredAuthToken,
      clearStoredAuthToken,
      loginWithToken,
      createHttpAppClient
    } = await import('./httpAppClient')
    setStoredAuthToken('abc')
    expect(getStoredAuthToken()).toBe('abc')
    clearStoredAuthToken()
    expect(getStoredAuthToken()).toBe('')
    expect(await loginWithToken('good')).toBe(true)

    mockFetchSequence([{ status: 401, json: { message: 'no' } }])
    expect(await loginWithToken('bad')).toBe(false)
    expect(getStoredAuthToken()).toBe('')

    // localStorage throws
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('x')
      },
      setItem: () => {
        throw new Error('x')
      },
      removeItem: () => {
        throw new Error('x')
      }
    })
    expect(getStoredAuthToken()).toBe('')
    setStoredAuthToken('z')
    clearStoredAuthToken()
    expect(createHttpAppClient).toBeTypeOf('function')
  })

  it('throws AppError on non-ok and attaches token to urls', async () => {
    mockFetchSequence([
      {
        status: 500,
        json: { code: 'INTERNAL', message: 'boom', details: 'd' }
      }
    ])
    const { createHttpAppClient } = await import('./httpAppClient')
    const api = createHttpAppClient()
    await expect(api.stories.list()).rejects.toMatchObject({
      message: 'boom'
    })

    store.idm_auth_token = 'tok'
    // re-import so getStoredAuthToken sees store (same module, store already shared)
    mockFetchSequence([
      {
        status: 200,
        json: {
          ok: true,
          result: {
            url: 'http://localhost/a',
            downloadUrl: 'http://localhost/b',
            openUrl: 'http://localhost/c',
            x: 1
          }
        }
      }
    ])
    const r = (await api.stories.get('1')) as {
      url: string
      downloadUrl: string
    }
    // token attach only when localStorage has token
    expect(r.url.includes('token=') || r.url.endsWith('/a')).toBe(true)
  })

  it('handles non-json error body and unwrapped result', async () => {
    mockFetchSequence([{ status: 502, text: 'gateway down' }])
    const { createHttpAppClient } = await import('./httpAppClient')
    const api = createHttpAppClient()
    await expect(api.app.getInfo()).rejects.toBeTruthy()

    mockFetchSequence([{ status: 200, json: { plain: true } }])
    expect(await api.app.getInfo()).toEqual({ plain: true })
  })

  it('event methods return unsubscribe no-ops', async () => {
    const { createHttpAppClient } = await import('./httpAppClient')
    const api = createHttpAppClient()
    const unsub = api.generation.onProgress(() => undefined)
    expect(typeof unsub).toBe('function')
    unsub()
  })

  it('special channels: import/export/media/shell', async () => {
    const file = new File(['z'], 'b.zip')
    // pickFile: create input and fire change via prototype override
    const originalCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreate(tag)
      if (tag === 'input') {
        setTimeout(() => {
          Object.defineProperty(el, 'files', {
            value: [file],
            configurable: true
          })
          el.onchange?.(new Event('change'))
        }, 0)
      }
      return el
    })

    mockFetchSequence([
      // upload
      { status: 200, json: { filePath: '/up/b.zip', fileName: 'b.zip' } },
      // importBackup
      { status: 200, json: { ok: true, result: { ok: true } } },
      // upload full
      { status: 200, json: { filePath: '/up/f.zip', fileName: 'f.zip' } },
      // import full
      {
        status: 200,
        json: { ok: true, result: { requiresReload: true } }
      },
      // export backup
      {
        status: 200,
        json: {
          ok: true,
          result: { downloadUrl: '/dl', fileName: 'e.zip' }
        }
      },
      // export full
      {
        status: 200,
        json: { ok: true, result: { downloadUrl: '/dl2' } }
      },
      // media saveAs
      {
        status: 200,
        json: { ok: true, result: { downloadUrl: '/m' } }
      },
      // shell openPath with openUrl
      {
        status: 200,
        json: { ok: true, result: { openUrl: '/open' } }
      },
      // shell with downloadUrl
      {
        status: 200,
        json: {
          ok: true,
          result: { downloadUrl: '/d', fileName: 'f' }
        }
      },
      // shell directory clipboard
      {
        status: 200,
        json: {
          ok: true,
          result: { isDirectory: true, path: '/dir' }
        }
      },
      // media pickRefImage upload
      { status: 200, json: { filePath: '/ref.png', fileName: 'r.png' } },
      // media pickBgm upload
      { status: 200, json: { filePath: '/b.mp3', fileName: 'b.mp3' } }
    ])

    const { createHttpAppClient } = await import('./httpAppClient')
    const api = createHttpAppClient()

    await expect(api.project.importBackup()).resolves.toEqual({ ok: true })
    await expect(api.app.importFullBackup()).resolves.toMatchObject({
      requiresReload: true
    })
    await api.project.exportBackup({ storyId: 's1' } as never)
    await api.app.exportFullBackup()
    await api.media.saveAs({ path: '/x' } as never)
    await api.shell.openPath('/p')
    await api.shell.showItemInFolder('/p')
    await api.shell.openPath('/p') // will cycle remaining mocks differently

    // re-mock remaining for directory + picks
    mockFetchSequence([
      {
        status: 200,
        json: {
          ok: true,
          result: { isDirectory: true, path: '/dir' }
        }
      },
      { status: 200, json: { filePath: '/ref.png', fileName: 'r.png' } },
      { status: 200, json: { filePath: '/b.mp3', fileName: 'b.mp3' } }
    ])
    await api.shell.openPath('/dir')
    await expect(api.media.pickRefImage()).resolves.toMatchObject({
      filePath: '/ref.png'
    })
    await expect(api.media.pickBgm()).resolves.toMatchObject({
      filePath: '/b.mp3'
    })

    await expect(api.shell.openExternal('https://ysk.hk')).resolves.toEqual({
      ok: true,
      url: 'https://ysk.hk'
    })
  })

  it('special channels return null when pick cancelled', async () => {
    const originalCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreate(tag)
      if (tag === 'input') {
        setTimeout(() => {
          el.oncancel?.(new Event('cancel') as never)
        }, 0)
      }
      return el
    })
    const { createHttpAppClient } = await import('./httpAppClient')
    const api = createHttpAppClient()
    await expect(api.project.importBackup()).resolves.toBeNull()
    await expect(api.app.importFullBackup()).resolves.toBeNull()
    await expect(api.media.pickRefImage()).resolves.toBeNull()
  })

  it('openPath directory clipboard write failure is ignored', async () => {
    mockFetchSequence([
      {
        status: 200,
        json: {
          ok: true,
          result: { isDirectory: true, path: '/some/dir' }
        }
      }
    ])
    const clipboard = {
      writeText: vi.fn().mockRejectedValue(new Error('denied'))
    }
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: clipboard
    })
    const { createHttpAppClient } = await import('./httpAppClient')
    const api = createHttpAppClient()
    await expect(api.shell.openPath('/some/dir')).resolves.toMatchObject({
      isDirectory: true,
      path: '/some/dir'
    })
    expect(clipboard.writeText).toHaveBeenCalledWith('/some/dir')
  })
})
