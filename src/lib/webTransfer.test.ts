/** @vitest-environment happy-dom */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  maybeDownloadResult,
  openInBrowserTab,
  pickFile,
  triggerBrowserDownload,
  uploadBrowserFile,
  withAuthQuery
} from './webTransfer'

describe('webTransfer', () => {
  let store: Record<string, string>

  beforeEach(() => {
    store = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
      removeItem: (k: string) => {
        delete store[k]
      }
    })
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('withAuthQuery variants', () => {
    expect(withAuthQuery('/api/download?p=x')).toBe('/api/download?p=x')
    store.idm_auth_token = 'secret'
    expect(withAuthQuery('/api/download?p=x')).toContain('token=secret')
    expect(withAuthQuery('http://h/a?x=1')).toContain('token=secret')
    expect(withAuthQuery('http://h/a?token=old')).toBe('http://h/a?token=old')
    expect(withAuthQuery('blob:abc')).toBe('blob:abc')
    expect(withAuthQuery('data:text/plain,hi')).toBe('data:text/plain,hi')
    expect(withAuthQuery('')).toBe('')
    expect(withAuthQuery('rel/path')).toContain('token=secret')
  })

  it('withAuthQuery survives localStorage throw', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('x')
      }
    })
    expect(withAuthQuery('/a')).toBe('/a')
  })

  it('triggerBrowserDownload and openInBrowserTab', () => {
    store.idm_auth_token = 't'
    const open = vi.fn()
    vi.stubGlobal('window', { ...window, open })
    const append = vi.spyOn(document.body, 'appendChild')
    triggerBrowserDownload('/api/f', 'f.bin')
    expect(append).toHaveBeenCalled()
    openInBrowserTab('/api/o')
    expect(open).toHaveBeenCalled()
  })

  it('pickFile resolves on change and cancel', async () => {
    const p1 = pickFile('image/*')
    const input = document.body.querySelector('input') as HTMLInputElement
    expect(input.accept).toBe('image/*')
    Object.defineProperty(input, 'files', {
      value: [new File(['x'], 'a.png')],
      configurable: true
    })
    input.onchange?.(new Event('change'))
    await expect(p1).resolves.toMatchObject({ name: 'a.png' })

    const p2 = pickFile()
    const input2 = document.body.querySelector('input') as HTMLInputElement
    input2.oncancel?.(new Event('cancel') as never)
    await expect(p2).resolves.toBeNull()
  })

  it('uploadBrowserFile success and failures', async () => {
    store.idm_auth_token = 'tok'
    const file = new File(['hi'], 'u.zip', { type: 'application/zip' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ filePath: '/tmp/u.zip', fileName: 'u.zip' })
      })
    )
    await expect(
      uploadBrowserFile(file, { subdir: 'uploads' })
    ).resolves.toEqual({ filePath: '/tmp/u.zip', fileName: 'u.zip' })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ result: { filePath: '/r', fileName: 'n' } })
      })
    )
    await expect(uploadBrowserFile(file)).resolves.toMatchObject({
      filePath: '/r'
    })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ message: 'up fail' })
      })
    )
    await expect(uploadBrowserFile(file)).rejects.toThrow('up fail')

    // Prefer nested error.message when present
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 413,
        text: async () =>
          JSON.stringify({ error: { message: 'payload too large' } })
      })
    )
    await expect(uploadBrowserFile(file)).rejects.toThrow('payload too large')

    // Fall back to generic HTTP status when body has no message
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => JSON.stringify({ code: 'x' })
      })
    )
    await expect(uploadBrowserFile(file)).rejects.toThrow(
      'Upload failed HTTP 502'
    )

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => 'not-json'
      })
    )
    await expect(uploadBrowserFile(file)).rejects.toThrow()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({})
      })
    )
    await expect(uploadBrowserFile(file)).rejects.toMatchObject({
      code: 'VALIDATION'
    })
  })

  it('maybeDownloadResult', () => {
    const spy = vi.spyOn(document, 'createElement')
    maybeDownloadResult(null)
    maybeDownloadResult({ foo: 1 })
    maybeDownloadResult({ downloadUrl: '/d', fileName: 'x' })
    expect(spy).toHaveBeenCalled()
  })
})
