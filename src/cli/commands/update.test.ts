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
    stderr: ''
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

const g = { json: true, pretty: false, yes: true, help: false, local: true } as never

describe('cmdUpdate', () => {
  beforeEach(() => {
    mockExit()
    vi.mocked(checkNpmPackageUpdate).mockClear()
    vi.mocked(installNpmPackageUpdate).mockClear()
  })
  afterEach(() => vi.restoreAllMocks())

  it('help check install paths', async () => {
    await cmdUpdate(g, ['help'], {})
    await cmdUpdate(g, [], {})
    await cmdUpdate({ ...g, json: false } as never, ['check'], {})
    await cmdUpdate(g, ['install'], { yes: true })
    await cmdUpdate(g, ['install', '1.2.0'], { yes: true })
    await cmdUpdate(g, ['install'], { version: 'v1.3.0', yes: true })

    await expect(cmdUpdate(g, ['nope'], {})).rejects.toThrow(/process.exit/)

    // without --yes: prints plan and returns (no exit)
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

  it('probeNpmUpdate export', async () => {
    const r = await probeNpmUpdate()
    expect(r).toBeTruthy()
  })
})
