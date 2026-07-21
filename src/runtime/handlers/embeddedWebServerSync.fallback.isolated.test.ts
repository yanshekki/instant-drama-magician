/**
 * Isolated resolveWebStaticDir fallback when no index.html.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    existsSync: (p: string) => {
      if (String(p).endsWith('index.html')) return false
      return actual.existsSync(p)
    }
  }
})

import { resolveWebStaticDir } from './embeddedWebServerSync'

describe('resolveWebStaticDir fallback', () => {
  it('returns first candidate when no index.html', async () => {
    const p = await resolveWebStaticDir()
    expect(typeof p).toBe('string')
    expect(p.length).toBeGreaterThan(0)
  })
})
