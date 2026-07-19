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
  })
})
