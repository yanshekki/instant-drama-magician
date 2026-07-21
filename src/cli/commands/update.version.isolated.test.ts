/**
 * Isolated currentCliVersion fallbacks.
 */
import { describe, expect, it, vi, afterEach } from 'vitest'

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    readFileSync: (p: string, enc?: unknown) => {
      if (String(p).includes('package.json')) {
        throw new Error('no pkg')
      }
      return actual.readFileSync(p, enc as never)
    }
  }
})

describe('currentCliVersion isolated', () => {
  afterEach(() => {
    delete process.env.npm_package_version
  })

  it('falls back to npm env then 0.0.0', async () => {
    process.env.npm_package_version = '6.6.6'
    const { currentCliVersion } = await import('./update')
    expect(currentCliVersion()).toBe('6.6.6')
    delete process.env.npm_package_version
    expect(currentCliVersion()).toBe('0.0.0')
  })
})
