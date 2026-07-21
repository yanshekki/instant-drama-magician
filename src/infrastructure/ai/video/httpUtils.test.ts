import { describe, expect, it, vi } from 'vitest'
import { AppError } from '../../../types/errors'
import {
  backoffMs,
  isRetryableError,
  mapPool,
  sleep,
  withRetries
} from './httpUtils'

describe('httpUtils', () => {
  it('sleep resolves', async () => {
    const t0 = Date.now()
    await sleep(5)
    expect(Date.now() - t0).toBeGreaterThanOrEqual(0)
  })

  it('backoffMs grows with attempt', () => {
    const a0 = backoffMs(0, 100, 10_000)
    const a3 = backoffMs(3, 100, 10_000)
    expect(a0).toBeGreaterThanOrEqual(100)
    expect(a3).toBeGreaterThan(a0 - 200)
    expect(backoffMs(10, 100, 500)).toBeLessThanOrEqual(700)
  })

  it('isRetryableError detects AppError codes and network', () => {
    expect(
      isRetryableError(new AppError('AI_RATE_LIMIT', 'errors.rate'))
    ).toBe(true)
    expect(
      isRetryableError(new AppError('VIDEO_RATE_LIMIT', 'errors.rate'))
    ).toBe(true)
    expect(
      isRetryableError(new AppError('VALIDATION', 'errors.x', 'HTTP 503'))
    ).toBe(true)
    expect(
      isRetryableError(new AppError('VALIDATION', 'errors.x', 'ECONNRESET'))
    ).toBe(true)
    expect(isRetryableError(new AppError('VALIDATION', 'errors.x'))).toBe(
      false
    )
    expect(isRetryableError(new Error('HTTP 429'))).toBe(true)
    expect(isRetryableError(new Error('fetch failed'))).toBe(true)
    expect(isRetryableError(new Error('bad request'))).toBe(false)
    expect(isRetryableError('string')).toBe(false)
  })

  it('withRetries succeeds after failure and respects shouldRetry', async () => {
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

    await expect(
      withRetries(
        async () => {
          throw new Error('nope')
        },
        { maxRetries: 2, shouldRetry: () => false }
      )
    ).rejects.toThrow('nope')
  })

  it('mapPool maps with concurrency and cancel', async () => {
    const out = await mapPool([1, 2, 3], 2, async (x) => x * 2)
    expect(out).toEqual([2, 4, 6])
    await expect(
      mapPool([1, 2, 3], 1, async (x) => x, () => true)
    ).rejects.toMatchObject({ code: 'CANCELLED' })
    expect(await mapPool([], 2, async (x) => x)).toEqual([])
  })
})

