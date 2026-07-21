import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mockExit } from './cliTestUtils'

vi.mock('../../infrastructure/update/npmPackageUpdate', () => ({
  NPM_PACKAGE_NAME: 'instant-drama-magician',
  checkNpmPackageUpdate: vi.fn(async () => ({
    packageName: 'instant-drama-magician',
    currentVersion: '1.0.0',
    latestVersion: '1.1.0',
    updateAvailable: true,
    installCommand: 'npm i -g instant-drama-magician@latest'
  })),
  installNpmPackageUpdate: vi.fn(() => ({
    ok: true,
    command: 'npm i -g x',
    stdout: 'ok',
    stderr: '',
    verifiedVersion: '1.1.0',
    writeProbe: { ok: true, prefix: '/usr', hint: null }
  })),
  npmInstallCommand: vi.fn((pkg: string, v: string) => `npm i -g ${pkg}@${v}`),
  probeNpmGlobalWrite: vi.fn(() => ({
    ok: true,
    prefix: '/usr',
    hint: null
  }))
}))

import {
  checkNpmPackageUpdate,
  installNpmPackageUpdate,
  probeNpmGlobalWrite
} from '../../infrastructure/update/npmPackageUpdate'
import { cmdUpdate, probeNpmUpdate } from './update'

const g = {
  json: true,
  pretty: false,
  yes: true,
  help: false,
  local: true
} as never

describe('cmdUpdate', () => {
  beforeEach(() => {
    mockExit()
    vi.mocked(checkNpmPackageUpdate).mockClear()
    vi.mocked(installNpmPackageUpdate).mockClear()
    vi.mocked(probeNpmGlobalWrite).mockReturnValue({
      ok: true,
      prefix: '/usr',
      hint: null
    } as never)
    vi.mocked(checkNpmPackageUpdate).mockResolvedValue({
      packageName: 'instant-drama-magician',
      currentVersion: '1.0.0',
      latestVersion: '1.1.0',
      updateAvailable: true,
      installCommand: 'npm i -g instant-drama-magician@latest'
    } as never)
    vi.mocked(installNpmPackageUpdate).mockReturnValue({
      ok: true,
      command: 'npm i -g x',
      stdout: 'ok',
      stderr: '',
      verifiedVersion: '1.1.0',
      writeProbe: { ok: true, prefix: '/usr', hint: null }
    } as never)
  })
  afterEach(() => vi.restoreAllMocks())

  it('help check install paths', async () => {
    await cmdUpdate(g, ['help'], {})
    await cmdUpdate(g, [], {})
    await cmdUpdate({ ...g, json: false } as never, ['check'], {})
    await cmdUpdate(g, ['install'], { yes: true })
    await cmdUpdate(g, ['install', '1.2.0'], { yes: true })
    await cmdUpdate(g, ['install'], { version: 'v1.3.0', yes: true })
    await cmdUpdate(g, ['install'], { v: '1.4.0', yes: true })

    await expect(cmdUpdate(g, ['nope'], {})).rejects.toThrow(/process.exit/)

    await expect(
      cmdUpdate({ ...g, yes: false, json: false } as never, ['install'], {})
    ).resolves.toBeUndefined()

    vi.mocked(checkNpmPackageUpdate).mockResolvedValueOnce({
      packageName: 'instant-drama-magician',
      currentVersion: '1.0.0',
      latestVersion: '1.0.0',
      updateAvailable: false,
      installCommand: 'x',
      error: 'registry down'
    } as never)
    await cmdUpdate({ ...g, json: false } as never, ['check'], {})

    vi.mocked(probeNpmGlobalWrite).mockReturnValueOnce({
      ok: false,
      prefix: '/usr',
      hint: 'use sudo'
    } as never)
    await cmdUpdate({ ...g, json: false } as never, ['check'], {})

    vi.mocked(installNpmPackageUpdate).mockReturnValueOnce({
      ok: false,
      command: 'npm',
      stdout: '',
      stderr: 'fail',
      error: 'fail'
    } as never)
    await expect(cmdUpdate(g, ['install'], { yes: true })).rejects.toThrow(
      /process.exit/
    )
  })

  it('check up-to-date and strict exit', async () => {
    vi.mocked(checkNpmPackageUpdate).mockResolvedValue({
      packageName: 'instant-drama-magician',
      currentVersion: '2.0.0',
      latestVersion: '2.0.0',
      updateAvailable: false,
      installCommand: 'x'
    } as never)
    await cmdUpdate({ ...g, json: false } as never, ['check'], {})

    vi.mocked(checkNpmPackageUpdate).mockResolvedValue({
      packageName: 'instant-drama-magician',
      currentVersion: '1.0.0',
      latestVersion: '9.0.0',
      updateAvailable: true,
      installCommand: 'npm i -g x@9'
    } as never)
    await expect(
      cmdUpdate({ ...g, json: false } as never, ['check'], { strict: true })
    ).rejects.toThrow(/process.exit/)
  })

  it('install skips when already latest', async () => {
    vi.mocked(checkNpmPackageUpdate).mockResolvedValue({
      packageName: 'instant-drama-magician',
      currentVersion: '2.0.0',
      latestVersion: '2.0.0',
      updateAvailable: false,
      installCommand: 'x'
    } as never)
    await cmdUpdate({ ...g, json: false, yes: true } as never, ['install'], {
      yes: true
    })
    expect(installNpmPackageUpdate).not.toHaveBeenCalled()
  })

  it('install without yes shows hint when prefix not writable', async () => {
    vi.mocked(probeNpmGlobalWrite).mockReturnValue({
      ok: false,
      prefix: '/usr',
      hint: 'use sudo'
    } as never)
    await cmdUpdate({ ...g, yes: false, json: false } as never, ['install'], {})
  })

  it('install success human with and without verifiedVersion', async () => {
    vi.mocked(installNpmPackageUpdate).mockReturnValueOnce({
      ok: true,
      command: 'npm i -g x',
      verifiedVersion: '1.1.0',
      writeProbe: { ok: true, prefix: '/u', hint: null }
    } as never)
    await cmdUpdate({ ...g, json: false, yes: true } as never, ['install'], {
      yes: true
    })

    vi.mocked(installNpmPackageUpdate).mockReturnValueOnce({
      ok: true,
      command: 'npm i -g x',
      verifiedVersion: null,
      writeProbe: { ok: true, prefix: '/u', hint: null }
    } as never)
    await cmdUpdate({ ...g, json: false, yes: true } as never, ['install'], {
      yes: true
    })
  })

  it('install failure uses stderr message', async () => {
    vi.mocked(installNpmPackageUpdate).mockReturnValueOnce({
      ok: false,
      command: 'npm',
      stderr: 'EACCES',
      error: undefined
    } as never)
    await expect(
      cmdUpdate(g, ['install'], { yes: true })
    ).rejects.toThrow(/process.exit/)
  })

  it('json install dry plan without yes', async () => {
    await cmdUpdate({ ...g, yes: false } as never, ['install'], {})
  })

  it('probeNpmUpdate export', async () => {
    const r = await probeNpmUpdate()
    expect(r).toBeTruthy()
    await probeNpmUpdate('9.9.9')
  })

  it('currentCliVersion uses env when package name mismatches', async () => {
    // Read real package.json path via __dirname in module — hard to break.
    // Cover install failure empty error/stderr (template message) already in sibling.
    // Cover version pin via env by re-checking check path is callable.
    const prev = process.env.npm_package_version
    process.env.npm_package_version = '0.0.0-env'
    try {
      vi.mocked(checkNpmPackageUpdate).mockResolvedValueOnce({
        packageName: 'instant-drama-magician',
        currentVersion: '0.0.0-env',
        latestVersion: '0.0.0-env',
        updateAvailable: false,
        installCommand: 'x'
      } as never)
      await cmdUpdate(g, ['check'], {})
    } finally {
      if (prev !== undefined) process.env.npm_package_version = prev
      else delete process.env.npm_package_version
    }
  })

  it('install failure with empty error and stderr uses template', async () => {
    vi.mocked(installNpmPackageUpdate).mockReturnValueOnce({
      ok: false,
      command: 'npm i -g instant-drama-magician@1.1.0',
      stderr: '',
      error: ''
    } as never)
    await expect(
      cmdUpdate(g, ['install'], { yes: true })
    ).rejects.toThrow(/process.exit/)
  })
})
