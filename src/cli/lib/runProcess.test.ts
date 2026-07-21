import { describe, expect, it, vi, afterEach } from 'vitest'
import { EventEmitter } from 'events'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const spawnMock = vi.fn()

vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args)
}))

import {
  runCommand,
  resolveNpm,
  resolveNpx,
  localBin,
  spawnDetached
} from './runProcess'

describe('runProcess', () => {
  afterEach(() => {
    spawnMock.mockReset()
    vi.restoreAllMocks()
  })

  it('resolveNpm / resolveNpx depend on platform', () => {
    const n = resolveNpm()
    const x = resolveNpx()
    if (process.platform === 'win32') {
      expect(n).toBe('npm.cmd')
      expect(x).toBe('npx.cmd')
    } else {
      expect(n).toBe('npm')
      expect(x).toBe('npx')
    }
  })

  it('localBin finds existing bin or returns null', () => {
    const root = join(
      tmpdir(),
      `idm-bin-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )
    const binDir = join(root, 'node_modules', '.bin')
    mkdirSync(binDir, { recursive: true })
    const name = process.platform === 'win32' ? 'electron.cmd' : 'electron'
    writeFileSync(join(binDir, name), '#!/bin/sh\n')
    expect(localBin(root, 'electron')).toBe(join(binDir, name))
    expect(localBin(root, 'missing-tool')).toBeNull()
    rmSync(root, { recursive: true, force: true })
  })

  it('runCommand resolves on close with inherit stdio', async () => {
    const child = new EventEmitter() as EventEmitter & {
      on: typeof EventEmitter.prototype.on
    }
    spawnMock.mockReturnValue(child)
    const p = runCommand('echo', ['hi'], { cwd: process.cwd() })
    child.emit('close', 0, null)
    await expect(p).resolves.toEqual({ code: 0, signal: null })
    expect(spawnMock).toHaveBeenCalledWith(
      'echo',
      ['hi'],
      expect.objectContaining({
        cwd: process.cwd(),
        stdio: 'inherit',
        shell: process.platform === 'win32'
      })
    )
  })

  it('runCommand uses pipe when inherit false and null code → 1', async () => {
    const child = new EventEmitter()
    spawnMock.mockReturnValue(child)
    const p = runCommand('cmd', [], {
      cwd: '/tmp',
      inherit: false,
      env: { FOO: '1' }
    })
    child.emit('close', null, 'SIGTERM')
    await expect(p).resolves.toEqual({ code: 1, signal: 'SIGTERM' })
    expect(spawnMock.mock.calls[0][2].stdio).toBe('pipe')
  })

  it('runCommand rejects on spawn error', async () => {
    const child = new EventEmitter()
    spawnMock.mockReturnValue(child)
    const p = runCommand('nope', [], { cwd: '/' })
    const err = new Error('spawn ENOENT')
    child.emit('error', err)
    await expect(p).rejects.toThrow('spawn ENOENT')
  })

  it('spawnDetached returns pid and unrefs', () => {
    const unref = vi.fn()
    spawnMock.mockReturnValue({ pid: 4242, unref })
    const pid = spawnDetached('true', [], { cwd: process.cwd() })
    expect(pid).toBe(4242)
    expect(unref).toHaveBeenCalled()
    expect(spawnMock).toHaveBeenCalledWith(
      'true',
      [],
      expect.objectContaining({
        detached: true,
        stdio: 'ignore'
      })
    )
  })

  it('spawnDetached returns 0 when pid missing', () => {
    spawnMock.mockReturnValue({ pid: undefined, unref: vi.fn() })
    expect(spawnDetached('x', [], {})).toBe(0)
  })

  it('localBin path existence check is real', () => {
    // sanity: repo may or may not have electron bin
    const r = localBin(process.cwd(), 'vitest')
    if (r) expect(existsSync(r)).toBe(true)
  })
})
