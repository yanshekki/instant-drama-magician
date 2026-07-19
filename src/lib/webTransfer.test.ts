import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { withAuthQuery } from './webTransfer'

describe('withAuthQuery', () => {
  beforeEach(() => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
      removeItem: (k: string) => {
        delete store[k]
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns url unchanged without token', () => {
    expect(withAuthQuery('/api/download?p=x')).toBe('/api/download?p=x')
  })

  it('appends token query when stored', () => {
    localStorage.setItem('idm_auth_token', 'secret')
    const u = withAuthQuery('/api/download?p=x')
    expect(u).toContain('token=secret')
  })

  it('leaves blob and data urls alone', () => {
    localStorage.setItem('idm_auth_token', 'secret')
    expect(withAuthQuery('blob:abc')).toBe('blob:abc')
    expect(withAuthQuery('data:text/plain,hi')).toBe('data:text/plain,hi')
  })
})
