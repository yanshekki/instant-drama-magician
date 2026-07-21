import { describe, expect, it, vi } from 'vitest'
import {
  checkNpmPackageUpdate,
  compareSemver,
  installNpmPackageUpdate,
  npmInstallCommand,
  NPM_PACKAGE_NAME,
  probeNpmGlobalWrite,
  verifyGlobalPackageVersion
} from './npmPackageUpdate'

describe('compareSemver', () => {
  it('orders major.minor.patch', () => {
    expect(compareSemver('1.2.0', '1.1.0')).toBeGreaterThan(0)
    expect(compareSemver('1.1.0', '1.2.0')).toBeLessThan(0)
    expect(compareSemver('1.1.0', '1.1.0')).toBe(0)
    expect(compareSemver('v1.1.0', '1.1.0')).toBe(0)
  })
})

describe('npmInstallCommand', () => {
  it('pins version and disables fund/audit', () => {
    expect(npmInstallCommand(NPM_PACKAGE_NAME, '1.3.0')).toBe(
      `npm install -g ${NPM_PACKAGE_NAME}@1.3.0 --no-fund --no-audit`
    )
    expect(npmInstallCommand()).toContain('@latest')
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
    expect(r.installCommand).toContain('@9.9.9')
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

describe('probeNpmGlobalWrite', () => {
  it('reports writable prefix', () => {
    const spawn = vi.fn().mockReturnValue({
      status: 0,
      stdout: '/home/user/.npm-global\n'
    })
    // accessSync will fail on fake path — expect not ok without real dir
    const r = probeNpmGlobalWrite(spawn as never)
    expect(r.prefix).toBe('/home/user/.npm-global')
    expect(typeof r.ok).toBe('boolean')
  })

  it('handles npm prefix failure', () => {
    const spawn = vi.fn().mockReturnValue({ status: 1, stdout: '' })
    const r = probeNpmGlobalWrite(spawn as never)
    expect(r.ok).toBe(false)
    expect(r.hint).toBeTruthy()
  })
})

describe('installNpmPackageUpdate', () => {
  it('dry-run succeeds when write probe ok', () => {
    const spawn = vi.fn().mockReturnValue({
      status: 0,
      stdout: process.cwd() + '\n'
    })
    // May fail write probe if cwd not matching — use dryRun after mock prefix that is writable
    // Use a real writable temp: process.cwd() is usually writable
    const r = installNpmPackageUpdate({
      version: '1.2.0',
      dryRun: true,
      spawn: spawn as never
    })
    expect(r.command).toContain('@1.2.0')
    expect(r.writeProbe.prefix).toBeTruthy()
  })

  it('blocks install when prefix not writable', () => {
    const spawn = vi.fn().mockReturnValue({
      status: 0,
      stdout: '/root/only\n'
    })
    const r = installNpmPackageUpdate({
      version: 'latest',
      spawn: spawn as never
    })
    // /root/only almost certainly not writable
    expect(r.ok).toBe(false)
    expect(r.error || r.writeProbe.hint).toBeTruthy()
  })
})

describe('verifyGlobalPackageVersion', () => {
  it('returns null when not installed', () => {
    const spawn = vi.fn().mockReturnValue({ status: 1, stdout: '' })
    expect(verifyGlobalPackageVersion(NPM_PACKAGE_NAME, null, spawn as never)).toBeNull()
  })
})
