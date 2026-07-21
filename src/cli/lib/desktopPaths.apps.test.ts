/**
 * Isolated Applications fallback coverage (mock fs.existsSync).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const existsSync = vi.hoisted(() => vi.fn<(p: string) => boolean>())
const readdirSync = vi.hoisted(() => vi.fn(() => [] as string[]))
const statSync = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('no')
  })
)

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    existsSync: (p: string) => existsSync(p),
    readdirSync: (p: string) => readdirSync(p),
    statSync: (p: string) => statSync(p)
  }
})

vi.mock('./repoRoot', () => ({
  releaseDir: (root: string) => `${root}/release`
}))

describe('desktopPaths Applications fallback isolated', () => {
  beforeEach(() => {
    existsSync.mockImplementation((p: string) => {
      const s = String(p)
      if (s.includes('/Applications/InstantDrama Magician.app')) return true
      if (s.endsWith('/release')) return true
      return false
    })
    readdirSync.mockReturnValue([])
    vi.resetModules()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns open-mac for Applications when no build artifacts', async () => {
    const { resolveLaunchTarget } = await import('./desktopPaths')
    const r = resolveLaunchTarget({
      repoRoot: '/tmp/empty-repo',
      platform: 'mac',
      preferDev: false
    })
    expect(r).toMatchObject({
      mode: 'packaged',
      platform: 'mac',
      method: 'open-mac'
    })
    expect(r?.path).toContain('Applications')
  })
})
