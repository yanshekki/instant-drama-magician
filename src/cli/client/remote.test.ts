import { describe, expect, it, afterEach, vi } from 'vitest'
import { createRemoteClient, isAuthError, isNetworkError } from './remote'
import { mockFetchSequence } from '../../test/httpMock'
import { AppError } from '../../types/errors'

describe('createRemoteClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('invokes channel and returns result', async () => {
    mockFetchSequence([
      { status: 200, json: { ok: true, result: [{ id: '1' }] } }
    ])
    const c = createRemoteClient({ url: 'http://127.0.0.1:8787', token: 't' })
    const r = await c.invoke('stories:list', [])
    expect(r).toEqual([{ id: '1' }])
    expect(c.mode).toBe('remote')
  })

  it('throws AI_UNAUTHORIZED on 401', async () => {
    mockFetchSequence([{ status: 401, json: { message: 'no' } }])
    const c = createRemoteClient({ url: 'http://x', token: 'bad' })
    await expect(c.invoke('stories:list')).rejects.toMatchObject({
      code: 'AI_UNAUTHORIZED'
    })
  })

  it('lists channels', async () => {
    mockFetchSequence([
      { status: 200, json: { channels: ['stories:list', 'ai:status'] } }
    ])
    const c = createRemoteClient({ url: 'http://x', token: 't' })
    expect(await c.channels()).toEqual(['stories:list', 'ai:status'])
  })

  it('isAuthError / isNetworkError helpers', () => {
    expect(isAuthError(new AppError('AI_UNAUTHORIZED', 'x'))).toBe(true)
    expect(isNetworkError(new AppError('IO', 'Cannot reach IDM server'))).toBe(
      true
    )
    expect(isAuthError(new Error('Unauthorized'))).toBe(true)
    expect(isNetworkError(new Error('fetch failed ECONNREFUSED'))).toBe(true)
    expect(isAuthError(new Error('other'))).toBe(false)
    expect(isNetworkError(new Error('other'))).toBe(false)
  })

  it('network error on invoke fetch failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    )
    const c = createRemoteClient({ url: 'http://down/' })
    await expect(c.invoke('stories:list')).rejects.toMatchObject({
      code: 'IO'
    })
  })

  it('invalid JSON body throws IO', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        text: async () => 'not-json{'
      })
    )
    const c = createRemoteClient({ url: 'http://x', token: null })
    await expect(c.invoke('x')).rejects.toMatchObject({ code: 'IO' })
  })

  it('ok:false with error payload and without token header', async () => {
    mockFetchSequence([
      {
        status: 400,
        json: {
          ok: false,
          error: { code: 'VALIDATION', message: 'bad', details: 'd' }
        }
      }
    ])
    const c = createRemoteClient({ url: 'http://x' })
    await expect(c.invoke('stories:create', [{}])).rejects.toMatchObject({
      code: 'VALIDATION',
      message: 'bad'
    })
  })

  it('ok:false falls back to message / HTTP status', async () => {
    mockFetchSequence([
      { status: 500, json: { ok: false, message: 'server down' } }
    ])
    const c = createRemoteClient({ url: 'http://x', token: 't' })
    await expect(c.invoke('x')).rejects.toMatchObject({ message: 'server down' })
  })

  it('channels network failure and 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('offline'))
    )
    const c = createRemoteClient({ url: 'http://x', token: 't' })
    await expect(c.channels()).rejects.toMatchObject({ code: 'IO' })

    mockFetchSequence([{ status: 401, json: {} }])
    await expect(c.channels()).rejects.toMatchObject({
      code: 'AI_UNAUTHORIZED'
    })
  })

  it('channels empty body yields []', async () => {
    mockFetchSequence([{ status: 200, json: {} }])
    const c = createRemoteClient({ url: 'http://x', token: 't' })
    expect(await c.channels()).toEqual([])
  })

  it('describe reports remote url and auth', () => {
    const c = createRemoteClient({ url: 'http://x/', token: 't' })
    expect(c.describe?.()).toMatchObject({
      mode: 'remote',
      url: 'http://x',
      auth: true
    })
  })
})
