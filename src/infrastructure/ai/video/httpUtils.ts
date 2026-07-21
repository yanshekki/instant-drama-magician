import { AppError } from '../../../types/errors'
/** Shared retry / sleep helpers for video HTTP client */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function backoffMs(attempt: number, base = 500, cap = 8000): number {
  const exp = Math.min(cap, base * 2 ** attempt)
  const jitter = Math.floor(Math.random() * 200)
  return exp + jitter
}

export async function withRetries<T>(
  fn: (attempt: number) => Promise<T>,
  opts: { maxRetries: number; shouldRetry?: (error: unknown, attempt: number) => boolean }
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn(attempt)
    } catch (error) {
      lastError = error
      const retry =
        attempt < opts.maxRetries &&
        (opts.shouldRetry?.(error, attempt) ?? isRetryableError(error))
      if (!retry) throw error
      await sleep(backoffMs(attempt))
    }
  }
  throw lastError
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof AppError) {
    if (error.code === 'AI_RATE_LIMIT' || error.code === 'VIDEO_RATE_LIMIT') {
      return true
    }
    const blob = `${error.message} ${error.details ?? ''}`
    if (/\b(429|502|503|504)\b/.test(blob)) return true
    if (/network|fetch failed|ECONNRESET|ETIMEDOUT|timeout/i.test(blob)) {
      return true
    }
    return false
  }
  if (error instanceof Error) {
    const m = error.message
    if (/\b(429|502|503|504)\b/.test(m)) return true
    if (/network|fetch failed|ECONNRESET|ETIMEDOUT|timeout/i.test(m)) return true
  }
  return false
}

/** Simple concurrency pool */
export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  isCancelled?: () => boolean
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const limit = Math.max(1, concurrency)

  async function run(): Promise<void> {
    while (next < items.length) {
      if (isCancelled?.()) throw new AppError('CANCELLED', 'errors.cancelled')
      const i = next++
      results[i] = await worker(items[i], i)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()))
  return results
}
