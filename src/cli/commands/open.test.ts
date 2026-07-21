import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mockExit } from './cliTestUtils'

const hostPlatform = vi.fn(() => 'linux')
const resolveLaunchTarget = vi.fn()
const runCommand = vi.fn(async () => ({ code: 0, stdout: '', stderr: '' }))
const spawnDetached = vi.fn(() => 1234)
const cmdBuild = vi.fn(async () => undefined)
const chmodSync = vi.fn()

vi.mock('../lib/repoRoot', () => ({
  findRepoRoot: () => '/repo'
}))
vi.mock('../lib/platform', () => ({
  hostPlatform: () => hostPlatform()
}))
vi.mock('../lib/desktopPaths', () => ({
  resolveLaunchTarget: (...a: unknown[]) => resolveLaunchTarget(...a)
}))
vi.mock('../lib/runProcess', () => ({
  resolveNpm: () => 'npm',
  runCommand: (...a: unknown[]) => runCommand(...(a as [])),
  spawnDetached: (...a: unknown[]) => spawnDetached(...(a as []))
}))
vi.mock('./build', () => ({
  cmdBuild: (...a: unknown[]) => cmdBuild(...(a as []))
}))
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return { ...actual, chmodSync: (...a: unknown[]) => chmodSync(...a) }
})

import { cmdOpen } from './open'

const g = {
  json: true,
  pretty: false,
  yes: false,
  help: false,
  local: true
} as never

describe('cmdOpen', () => {
  beforeEach(() => {
    mockExit()
    hostPlatform.mockReturnValue('linux')
    resolveLaunchTarget.mockReset()
    spawnDetached.mockReturnValue(1234)
    runCommand.mockResolvedValue({ code: 0, stdout: '', stderr: '' })
    chmodSync.mockReset()
    cmdBuild.mockClear()
  })
  afterEach(() => vi.restoreAllMocks())

  it('dev launch and packaged spawn', async () => {
    resolveLaunchTarget.mockReturnValue({
      mode: 'dev',
      path: '/repo',
      method: 'spawn',
      platform: 'linux'
    })
    await cmdOpen(g, [], { dev: true, detached: true })

    resolveLaunchTarget.mockReturnValue({
      mode: 'packaged',
      path: '/app/AppImage',
      method: 'appimage',
      platform: 'linux'
    })
    await cmdOpen(g, ['--foo'], { detached: true })

    resolveLaunchTarget.mockReturnValue({
      mode: 'packaged',
      path: '/App.app',
      method: 'open-mac',
      platform: 'mac'
    })
    await cmdOpen(g, ['a'], { detached: true })
    await cmdOpen(g, [], { detached: false })

    resolveLaunchTarget.mockReturnValue(null)
    await expect(cmdOpen(g, [], {})).rejects.toThrow(/process.exit/)

    resolveLaunchTarget
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({
        mode: 'packaged',
        path: '/x',
        method: 'spawn',
        platform: 'linux'
      })
    await cmdOpen(g, [], { buildIfMissing: true })
    expect(cmdBuild).toHaveBeenCalled()
  })

  it('non-detached open-mac and spawn failures', async () => {
    resolveLaunchTarget.mockReturnValue({
      mode: 'packaged',
      path: '/App.app',
      method: 'open-mac',
      platform: 'mac'
    })
    runCommand.mockResolvedValueOnce({ code: 1, stdout: '', stderr: '' })
    await expect(
      cmdOpen(g, ['--arg'], { detached: false })
    ).rejects.toThrow(/process.exit/)

    resolveLaunchTarget.mockReturnValue({
      mode: 'packaged',
      path: '/bin/app',
      method: 'spawn',
      platform: 'linux',
      args: ['--extra']
    })
    runCommand.mockResolvedValueOnce({ code: 2, stdout: '', stderr: '' })
    await expect(
      cmdOpen(g, [], { detached: false })
    ).rejects.toThrow(/process.exit/)
  })

  it('human mode launch and chmod ignore', async () => {
    resolveLaunchTarget.mockReturnValue({
      mode: 'packaged',
      path: '/app.AppImage',
      method: 'appimage',
      platform: 'linux'
    })
    chmodSync.mockImplementation(() => {
      throw new Error('chmod deny')
    })
    await cmdOpen(
      { ...g, json: false } as never,
      [],
      { detached: true, appPath: '/app.AppImage' }
    )
    expect(spawnDetached).toHaveBeenCalled()
  })

  it('spawnDetached throws → emitFailure', async () => {
    resolveLaunchTarget.mockReturnValue({
      mode: 'packaged',
      path: '/x',
      method: 'spawn',
      platform: 'linux'
    })
    spawnDetached.mockImplementationOnce(() => {
      throw new Error('spawn fail')
    })
    await expect(cmdOpen(g, [], { detached: true })).rejects.toThrow(
      /process.exit/
    )
  })

  it('dev non-detached failure and human detached', async () => {
    resolveLaunchTarget.mockReturnValue({
      mode: 'dev',
      path: '/repo',
      method: 'spawn',
      platform: 'linux'
    })
    await cmdOpen(
      { ...g, json: false } as never,
      [],
      { dev: true, detached: true }
    )

    runCommand.mockResolvedValueOnce({ code: 3, stdout: '', stderr: '' })
    await expect(
      cmdOpen(g, [], { dev: true, detached: false })
    ).rejects.toThrow(/process.exit/)
  })

  it('sandbox flag and IDM_DATA_DIR env on spawn', async () => {
    const prev = process.env.IDM_DATA_DIR
    process.env.IDM_DATA_DIR = '/data'
    resolveLaunchTarget.mockReturnValue({
      mode: 'packaged',
      path: '/x',
      method: 'spawn',
      platform: 'linux'
    })
    await cmdOpen(g, [], { detached: true, sandbox: true })
    expect(spawnDetached).toHaveBeenCalled()
    if (prev === undefined) delete process.env.IDM_DATA_DIR
    else process.env.IDM_DATA_DIR = prev
  })

  it('win platform skips linux no-sandbox', async () => {
    hostPlatform.mockReturnValue('win')
    resolveLaunchTarget.mockReturnValue({
      mode: 'packaged',
      path: 'C:\\app.exe',
      method: 'spawn',
      platform: 'win'
    })
    await cmdOpen(g, [], { detached: true })
    expect(spawnDetached).toHaveBeenCalled()
  })
})
