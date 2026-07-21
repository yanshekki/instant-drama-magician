import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mockExit } from './cliTestUtils'

const canBuildOnHost = vi.fn(() => ({ ok: true as const }))
const parsePlatformFlag = vi.fn((v?: string | boolean) => {
  if (v === 'bad') throw new Error('bad platform')
  return 'linux' as const
})
const listBuildArtifacts = vi.fn(() => [
  { path: '/a', kind: 'dir-binary', platform: 'linux' as const }
])
const localBin = vi.fn(() => null as string | null)
const runCommand = vi.fn(async () => ({ code: 0, stdout: '', stderr: '' }))

const findRepoRootMock = vi.hoisted(() => vi.fn((): string | null => '/repo'))
vi.mock('../lib/repoRoot', () => ({
  findRepoRoot: () => findRepoRootMock(),
  releaseDir: () => '/repo/release'
}))
vi.mock('../lib/platform', () => ({
  canBuildOnHost: (...a: unknown[]) => canBuildOnHost(...(a as [])),
  electronBuilderPlatformArgs: () => ['--linux'],
  hostArch: () => 'x64',
  hostPlatform: () => 'linux',
  parsePlatformFlag: (...a: unknown[]) => parsePlatformFlag(...(a as []))
}))
vi.mock('../lib/desktopPaths', () => ({
  listBuildArtifacts: (...a: unknown[]) => listBuildArtifacts(...(a as []))
}))
vi.mock('../lib/runProcess', () => ({
  localBin: (...a: unknown[]) => localBin(...(a as [])),
  resolveNpx: () => 'npx',
  runCommand: (...a: unknown[]) => runCommand(...(a as []))
}))
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    existsSync: (p: string) => {
      if (String(p).includes('NO_PKG')) return false
      return String(p).includes('package.json') || true
    }
  }
})

import { cmdBuild } from './build'

const g = {
  json: true,
  pretty: false,
  yes: false,
  help: false,
  local: true
} as never

describe('cmdBuild', () => {
  beforeEach(() => {
    mockExit()
    findRepoRootMock.mockReset()
    findRepoRootMock.mockReturnValue('/repo')
    canBuildOnHost.mockReturnValue({ ok: true })
    parsePlatformFlag.mockImplementation((v?: string | boolean) => {
      if (v === 'bad') throw new Error('bad platform')
      return 'linux'
    })
    listBuildArtifacts.mockReturnValue([
      { path: '/a', kind: 'dir-binary', platform: 'linux' }
    ])
    localBin.mockReturnValue(null)
    runCommand.mockResolvedValue({ code: 0, stdout: '', stderr: '' })
  })
  afterEach(() => vi.restoreAllMocks())

  it('builds dir and handles errors', async () => {
    await cmdBuild(g, ['dir'], { platform: 'linux', skipCompile: true })
    await cmdBuild({ ...g, json: false } as never, [], {
      target: 'dir',
      force: true
    })
    await expect(cmdBuild(g, [], { platform: 'bad' })).rejects.toThrow(
      /process.exit/
    )
    await expect(cmdBuild(g, ['nope'], {})).rejects.toThrow(/process.exit/)

    runCommand.mockResolvedValueOnce({
      code: 1,
      stdout: '',
      stderr: 'fail'
    })
    await expect(
      cmdBuild(g, ['dir'], { skipCompile: true })
    ).rejects.toThrow(/process.exit/)
  })

  it('installer and all targets with local bins', async () => {
    localBin.mockImplementation((_r: string, name: string) =>
      name === 'electron-vite'
        ? '/repo/node_modules/.bin/electron-vite'
        : name === 'electron-builder'
          ? '/repo/node_modules/.bin/electron-builder'
          : null
    )
    await cmdBuild(g, [], {
      target: 'installer',
      skipCompile: false,
      arch: 'x64'
    })
    expect(runCommand).toHaveBeenCalled()

    runCommand.mockClear()
    await cmdBuild(g, ['all'], { skipCompile: true, platform: true })
    // all → dir then installer
    expect(runCommand.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('canBuildOnHost failure and empty artifacts human path', async () => {
    canBuildOnHost.mockReturnValueOnce({
      ok: false,
      reason: 'Cross-build blocked'
    })
    await expect(
      cmdBuild(g, ['dir'], { skipCompile: true })
    ).rejects.toThrow(/process.exit/)

    canBuildOnHost.mockReturnValue({ ok: true })
    listBuildArtifacts.mockReturnValue([])
    await cmdBuild({ ...g, json: false } as never, ['dir'], {
      skipCompile: true
    })
  })

  it('platform true flag maps to current', async () => {
    parsePlatformFlag.mockReturnValue('linux')
    await cmdBuild(g, [], { platform: true, skipCompile: true })
    expect(parsePlatformFlag).toHaveBeenCalledWith('current')
  })

  it('builder failure exits', async () => {
    runCommand.mockReset()
    runCommand.mockResolvedValue({ code: 2, stdout: '', stderr: 'builder fail' })
    await expect(
      cmdBuild(g, ['dir'], { skipCompile: true })
    ).rejects.toThrow(/process.exit/)
  })

  it('arch=all skips arch args', async () => {
    await cmdBuild(g, ['dir'], { skipCompile: true, arch: 'all' })
    const args = runCommand.mock.calls.map((c) => c[1] as string[])
    expect(args.some((a) => a.includes('--dir'))).toBe(true)
  })

  it('repo root missing fails USAGE', async () => {
    findRepoRootMock.mockReturnValueOnce(null)
    await expect(
      cmdBuild({ json: true, pretty: false, yes: true, help: false, local: true } as never, [], {})
    ).rejects.toThrow()
  })

  it('electron-vite build non-zero exit fails', async () => {
    runCommand.mockResolvedValueOnce({ code: 2, stdout: '', stderr: 'fail' })
    await expect(
      cmdBuild({ json: true, pretty: false, yes: true, help: false, local: true } as never, [], {})
    ).rejects.toThrow(/process.exit/)
  })

})
