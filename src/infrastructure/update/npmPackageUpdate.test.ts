import { describe, expect, it, vi } from 'vitest'
import {
  checkNpmPackageUpdate,
  compareSemver,
  NPM_PACKAGE_NAME
} from './npmPackageUpdate'

describe('compareSemver', () => {
  it('orders major.minor.patch', () => {
    expect(compareSemver('1.2.0', '1.1.0')).toBeGreaterThan(0)
    expect(compareSemver('1.1.0', '1.2.0')).toBeLessThan(0)
    expect(compareSemver('1.1.0', '1.1.0')).toBe(0)
    expect(compareSemver('v1.1.0', '1.1.0')).toBe(0)
  })
})

describe('checkNpmPackageUpdate', () => {
  it('detects update available', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: '9.9.9' })
    })
    const r = await checkNpmPackageUpdate(NPM_PACKAGE_NAME, '1.1.0', {
      fetchImpl: fetchImpl as unknown as typeof fetch
    })
    expect(r.updateAvailable).toBe(true)
    expect(r.latestVersion).toBe('9.9.9')
    expect(r.installCommand).toContain('@latest')
  })

  it('marks up-to-date when equal', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: '1.1.0' })
    })
    const r = await checkNpmPackageUpdate(NPM_PACKAGE_NAME, '1.1.0', {
      fetchImpl: fetchImpl as unknown as typeof fetch
    })
    expect(r.updateAvailable).toBe(false)
    expect(r.error).toBeUndefined()
  })

  it('returns soft error offline', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'))
    const r = await checkNpmPackageUpdate(NPM_PACKAGE_NAME, '1.1.0', {
      fetchImpl: fetchImpl as unknown as typeof fetch
    })
    expect(r.updateAvailable).toBe(false)
    expect(r.error).toMatch(/network/i)
  })
})
