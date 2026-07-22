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
    expect(npmInstallCommand(NPM_PACKAGE_NAME, '1.3.1')).toBe(
      `npm install -g ${NPM_PACKAGE_NAME}@1.3.1 --no-fund --no-audit`
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

  it('HTTP error and empty version and missing fetch', async () => {
    const bad = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({})
    })
    const r1 = await checkNpmPackageUpdate(NPM_PACKAGE_NAME, '1.0.0', {
      fetchImpl: bad as never,
      tag: 'next'
    })
    expect(r1.error).toMatch(/HTTP 503/)

    const empty = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({})
    })
    const r2 = await checkNpmPackageUpdate(NPM_PACKAGE_NAME, '1.0.0', {
      fetchImpl: empty as never
    })
    expect(r2.error).toMatch(/no version/)

    const r3 = await checkNpmPackageUpdate(NPM_PACKAGE_NAME, '1.0.0', {
      fetchImpl: undefined as never
    })
    // may use global fetch or error — just ensure object
    expect(r3).toHaveProperty('updateAvailable')
  })
})

describe('probeNpmGlobalWrite', () => {
  it('reports writable prefix', () => {
    const spawn = vi.fn().mockReturnValue({
      status: 0,
      stdout: process.cwd() + '\n'
    })
    const r = probeNpmGlobalWrite(spawn as never)
    expect(r.prefix).toBe(process.cwd())
    expect(r.ok).toBe(true)
  })

  it('handles npm prefix failure', () => {
    const spawn = vi.fn().mockReturnValue({ status: 1, stdout: '' })
    const r = probeNpmGlobalWrite(spawn as never)
    expect(r.ok).toBe(false)
    expect(r.hint).toBeTruthy()
  })

  it('empty prefix and spawn throw', () => {
    expect(
      probeNpmGlobalWrite(
        vi.fn().mockReturnValue({ status: 0, stdout: '  \n' }) as never
      ).ok
    ).toBe(false)
    expect(
      probeNpmGlobalWrite(
        vi.fn().mockImplementation(() => {
          throw new Error('spawn boom')
        }) as never
      ).hint
    ).toMatch(/spawn boom/)
  })

  it('not writable prefix gives platform hint', () => {
    const spawn = vi.fn().mockReturnValue({
      status: 0,
      stdout: '/root/only\n'
    })
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
    const r = installNpmPackageUpdate({
      version: '1.2.0',
      dryRun: true,
      spawn: spawn as never
    })
    expect(r.command).toContain('@1.2.0')
    expect(r.writeProbe.prefix).toBeTruthy()
    expect(r.ok).toBe(true)
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
    expect(r.ok).toBe(false)
    expect(r.error || r.writeProbe.hint).toBeTruthy()
  })

  it('runs install and verifies version on success', () => {
    const { mkdirSync, writeFileSync, rmSync } = require('fs') as typeof import('fs')
    const { join } = require('path') as typeof import('path')
    const { tmpdir } = require('os') as typeof import('os')
    const prefix = join(tmpdir(), `npm-pfx-${Date.now()}`)
    const pkgDir = join(prefix, 'lib', 'node_modules', NPM_PACKAGE_NAME)
    mkdirSync(pkgDir, { recursive: true })
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ version: '2.0.0' })
    )
    try {
      let calls = 0
      const spawn = vi.fn((cmd: string, args: string[]) => {
        calls++
        if (args?.[0] === 'prefix') {
          return { status: 0, stdout: prefix + '\n' }
        }
        if (args?.[0] === 'install') {
          return { status: 0, stdout: 'ok', stderr: '' }
        }
        return { status: 1, stdout: '' }
      })
      const r = installNpmPackageUpdate({
        version: '2.0.0',
        spawn: spawn as never,
        inheritStdio: false
      })
      expect(r.ok).toBe(true)
      expect(r.verifiedVersion).toBe('2.0.0')
      expect(calls).toBeGreaterThan(0)
    } finally {
      rmSync(prefix, { recursive: true, force: true })
    }
  })

  it('install failure returns stderr summary', () => {
    const spawn = vi.fn((cmd: string, args: string[]) => {
      if (args?.[0] === 'prefix') {
        return { status: 0, stdout: process.cwd() + '\n' }
      }
      return {
        status: 1,
        stderr: 'line1\nline2\nerr',
        stdout: '',
        error: undefined
      }
    })
    const r = installNpmPackageUpdate({
      version: '9.0.0',
      spawn: spawn as never
    })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/npm install failed/)
  })
})

describe('verifyGlobalPackageVersion', () => {
  it('returns null when not installed', () => {
    const spawn = vi.fn().mockReturnValue({ status: 1, stdout: '' })
    expect(
      verifyGlobalPackageVersion(NPM_PACKAGE_NAME, null, spawn as never)
    ).toBeNull()
  })

  it('reads package.json under prefix lib and node_modules', () => {
    const { mkdirSync, writeFileSync, rmSync } = require('fs') as typeof import('fs')
    const { join } = require('path') as typeof import('path')
    const { tmpdir } = require('os') as typeof import('os')
    const prefix = join(tmpdir(), `npm-v-${Date.now()}`)
    const lib = join(prefix, 'lib', 'node_modules', NPM_PACKAGE_NAME)
    mkdirSync(lib, { recursive: true })
    writeFileSync(join(lib, 'package.json'), JSON.stringify({ version: '3.1.0' }))
    try {
      expect(
        verifyGlobalPackageVersion(NPM_PACKAGE_NAME, prefix, vi.fn() as never)
      ).toBe('3.1.0')
    } finally {
      rmSync(prefix, { recursive: true, force: true })
    }

    const prefix2 = join(tmpdir(), `npm-v2-${Date.now()}`)
    const nm = join(prefix2, 'node_modules', NPM_PACKAGE_NAME)
    mkdirSync(nm, { recursive: true })
    writeFileSync(join(nm, 'package.json'), JSON.stringify({ version: '3.2.0' }))
    try {
      expect(
        verifyGlobalPackageVersion(NPM_PACKAGE_NAME, prefix2, vi.fn() as never)
      ).toBe('3.2.0')
    } finally {
      rmSync(prefix2, { recursive: true, force: true })
    }
  })

  it('falls back to npm list -g json', () => {
    const spawn = vi.fn().mockReturnValue({
      status: 0,
      stdout: JSON.stringify({
        dependencies: { [NPM_PACKAGE_NAME]: { version: '4.0.0' } }
      })
    })
    expect(
      verifyGlobalPackageVersion(NPM_PACKAGE_NAME, null, spawn as never)
    ).toBe('4.0.0')
  })
})
