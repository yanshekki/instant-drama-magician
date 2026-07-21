import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mockExit } from './cliTestUtils'

vi.mock('../lib/repoRoot', () => ({
  findRepoRoot: () => '/repo',
  releaseDir: () => '/repo/release'
}))
vi.mock('../lib/platform', () => ({
  canBuildOnHost: () => ({ ok: true }),
  electronBuilderPlatformArgs: () => ['--linux', 'dir'],
  hostArch: () => 'x64',
  hostPlatform: () => 'linux',
  parsePlatformFlag: (v?: string) => {
    if (v === 'bad') throw new Error('bad platform')
    return 'linux'
  }
}))
vi.mock('../lib/desktopPaths', () => ({
  listBuildArtifacts: () => [{ path: '/a', kind: 'dir' }]
}))
vi.mock('../lib/runProcess', () => ({
  localBin: () => null,
  resolveNpx: () => 'npx',
  runCommand: vi.fn(async () => ({ code: 0, stdout: '', stderr: '' }))
}))
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    existsSync: (p: string) => String(p).includes('package.json') || true
  }
})

import { runCommand } from '../lib/runProcess'
import { cmdBuild } from './build'

const g = { json: true, pretty: false, yes: false, help: false, local: true } as never

describe('cmdBuild', () => {
  beforeEach(() => {
    mockExit()
    vi.mocked(runCommand).mockResolvedValue({ code: 0, stdout: '', stderr: '' })
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

    vi.mocked(runCommand).mockResolvedValueOnce({
      code: 1,
      stdout: '',
      stderr: 'fail'
    })
    await expect(
      cmdBuild(g, ['dir'], { skipCompile: true })
    ).rejects.toThrow(/process.exit/)
  })
})
