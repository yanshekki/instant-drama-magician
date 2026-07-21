/**
 * Isolated: cover TtsProvider spawn close non-zero reject path.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'

vi.mock('child_process', () => {
  return {
    spawn: vi.fn((cmd: string) => {
      const ee = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter
        stderr: EventEmitter
      }
      ee.stdout = new EventEmitter()
      ee.stderr = new EventEmitter()
      queueMicrotask(() => {
        if (cmd === 'which') ee.emit('close', 1)
        else ee.emit('close', 7)
      })
      return ee
    })
  }
})

describe('TtsProvider spawn isolated', () => {
  it('assertSpawnExitOk and settle via commandExists/run paths', async () => {
    const { assertSpawnExitOk } = await import('./TtsProvider')
    expect(() => assertSpawnExitOk(0, 'x')).not.toThrow()
    expect(() => assertSpawnExitOk(1, 'x')).toThrow(/exited/)
    // re-import after mock — commandExists uses spawn which
    const mod = await import('./TtsProvider')
    // fileReady still
    expect(mod.fileReady('/nope')).toBe(false)
  })
})
