import { describe, expect, it, vi } from 'vitest'
import {
  backoffMs,
  isRetryableError,
  mapPool,
  withRetries
} from './httpUtils'

describe('httpUtils', () => {
  it('backoffMs grows with attempt', () => {
    const a0 = backoffMs(0, 100, 10_000)
    const a3 = backoffMs(3, 100, 10_000)
    expect(a0).toBeGreaterThanOrEqual(100)
    expect(a3).toBeGreaterThan(a0 - 200)
  })

  it('isRetryableError detects 429 and network', () => {
    expect(isRetryableError(new Error('HTTP 429'))).toBe(true)
    expect(isRetryableError(new Error('fetch failed'))).toBe(true)
    expect(isRetryableError(new Error('bad request'))).toBe(false)
  })

  it('withRetries succeeds after failure', async () => {
    let n = 0
    const v = await withRetries(
      async () => {
        n++
        if (n < 2) throw new Error('503 unavailable')
        return 42
      },
      { maxRetries: 3 }
    )
    expect(v).toBe(42)
    expect(n).toBe(2)
  })

  it('mapPool maps with concurrency', async () => {
    const out = await mapPool([1, 2, 3], 2, async (x) => x * 2)
    expect(out).toEqual([2, 4, 6])
  })
})
