/**
 * Isolated packageVersion fallbacks (mock fs readFileSync).
 */
import { describe, expect, it, vi, afterEach } from 'vitest'

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    readFileSync: (p: string, enc?: unknown) => {
      if (String(p).includes('package.json')) {
        throw new Error('no package.json in test')
      }
      return actual.readFileSync(p, enc as never)
    }
  }
})

describe('packageVersion isolated fallbacks', () => {
  afterEach(() => {
    delete process.env.npm_package_version
  })

  it('uses npm_package_version then 1.0.0', async () => {
    process.env.npm_package_version = '7.7.7-iso'
    const { packageVersion } = await import('./bin')
    expect(packageVersion()).toBe('7.7.7-iso')
    delete process.env.npm_package_version
    expect(packageVersion()).toBe('1.0.0')
  })
})
