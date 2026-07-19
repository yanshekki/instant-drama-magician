import { describe, expect, it, vi, afterEach } from 'vitest'
import { mockFetchSequence } from '../test/httpMock'

// httpAppClient uses window + fetch — test channel mapping via dynamic import after stubs

describe('httpAppClient invoke mapping', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('posts channel derived from nested api call', async () => {
    const fetchMock = mockFetchSequence([
      { status: 200, json: { ok: true, result: { id: '1' } } }
    ])
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => 'tok',
        setItem: () => undefined,
        removeItem: () => undefined
      },
      location: { origin: 'http://localhost' }
    })
    const { createHttpAppClient } = await import('./httpAppClient')
    const api = createHttpAppClient()
    const r = await api.stories.list()
    expect(r).toEqual({ id: '1' })
    expect(fetchMock).toHaveBeenCalled()
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body
    )
    expect(body.channel).toBe('stories:list')
  })
})
