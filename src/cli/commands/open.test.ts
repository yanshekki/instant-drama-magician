import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mockExit } from './cliTestUtils'

vi.mock('../lib/repoRoot', () => ({
  findRepoRoot: () => '/repo'
}))
vi.mock('../lib/platform', () => ({
  hostPlatform: () => 'linux'
}))
vi.mock('../lib/desktopPaths', () => ({
  resolveLaunchTarget: vi.fn()
}))
vi.mock('../lib/runProcess', () => ({
  resolveNpm: () => 'npm',
  runCommand: vi.fn(async () => ({ code: 0, stdout: '', stderr: '' })),
  spawnDetached: vi.fn(() => 1234)
}))
vi.mock('./build', () => ({
  cmdBuild: vi.fn(async () => undefined)
}))
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return { ...actual, chmodSync: vi.fn() }
})

import { resolveLaunchTarget } from '../lib/desktopPaths'
import { spawnDetached, runCommand } from '../lib/runProcess'
import { cmdOpen } from './open'

const g = { json: true, pretty: false, yes: false, help: false, local: true } as never

describe('cmdOpen', () => {
  beforeEach(() => {
    mockExit()
    vi.mocked(resolveLaunchTarget).mockReset()
    vi.mocked(spawnDetached).mockReturnValue(1234)
    vi.mocked(runCommand).mockResolvedValue({ code: 0, stdout: '', stderr: '' })
  })
  afterEach(() => vi.restoreAllMocks())

  it('dev launch and packaged spawn', async () => {
    vi.mocked(resolveLaunchTarget).mockReturnValue({
      mode: 'dev',
      path: '/repo',
      method: 'spawn'
    } as never)
    await cmdOpen(g, [], { dev: true, detached: true })

    vi.mocked(resolveLaunchTarget).mockReturnValue({
      mode: 'packaged',
      path: '/app/AppImage',
      method: 'appimage'
    } as never)
    await cmdOpen(g, ['--foo'], { detached: true })

    vi.mocked(resolveLaunchTarget).mockReturnValue({
      mode: 'packaged',
      path: '/App.app',
      method: 'open-mac'
    } as never)
    await cmdOpen(g, ['a'], { detached: true })
    await cmdOpen(g, [], { detached: false })

    vi.mocked(resolveLaunchTarget).mockReturnValue(null)
    await expect(cmdOpen(g, [], {})).rejects.toThrow(/process.exit/)

    vi.mocked(resolveLaunchTarget)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({
        mode: 'packaged',
        path: '/x',
        method: 'spawn'
      } as never)
    await cmdOpen(g, [], { buildIfMissing: true })
  })
})
