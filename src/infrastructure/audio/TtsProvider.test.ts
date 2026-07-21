import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const spawn = vi.fn()
vi.mock('child_process', () => ({
  spawn: (...a: unknown[]) => spawn(...a)
}))

import {
  HttpTtsProvider,
  LocalCliTtsProvider,
  CompositeTtsProvider,
  ttsClipPath,
  ensurePathParent,
  fileReady
} from './TtsProvider'

function child(code = 0, err?: Error) {
  const c = new EventEmitter()
  queueMicrotask(() => {
    if (err) c.emit('error', err)
    else c.emit('close', code)
  })
  return c
}

describe('TtsProvider', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tts-'))
    spawn.mockReset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    rmSync(dir, { recursive: true, force: true })
  })

  it('HttpTtsProvider', async () => {
    const p = new HttpTtsProvider('http://tts', 'k')
    expect(await p.available()).toBe(true)
    expect(await new HttpTtsProvider('', '').available()).toBe(false)

    const out = join(dir, 'a.wav')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer
      }))
    )
    await expect(p.speak({ text: 'hi', outputPath: out })).resolves.toEqual({
      outputPath: out
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500 }))
    )
    await expect(p.speak({ text: 'hi', outputPath: out })).rejects.toMatchObject(
      { code: 'IO' }
    )
  })

  it('LocalCliTtsProvider detect and speak', async () => {
    const p = new LocalCliTtsProvider()
    spawn.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'which') {
        const name = args[0]
        return child(name === 'espeak' ? 0 : 1)
      }
      return child(0)
    })
    expect(await p.available()).toBe(true)
    const out = join(dir, 'e.wav')
    await p.speak({ text: 'hello', outputPath: out })

    // piper path
    spawn.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'which') {
        return child(args[0] === 'piper' ? 0 : 1)
      }
      return child(0)
    })
    const p2 = new LocalCliTtsProvider()
    await p2.available()
    await p2.speak({ text: 'hi', outputPath: join(dir, 'p.wav') })

    // none
    spawn.mockImplementation(() => child(1))
    const p3 = new LocalCliTtsProvider()
    expect(await p3.available()).toBe(false)
    await expect(
      p3.speak({ text: 'x', outputPath: join(dir, 'x.wav') })
    ).rejects.toMatchObject({ code: 'VALIDATION' })

    // which error
    spawn.mockImplementation(() => child(0, new Error('e')))
    expect(await new LocalCliTtsProvider().available()).toBe(false)

    // espeak-ng maps to espeak
    spawn.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'which') return child(args[0] === 'espeak-ng' ? 0 : 1)
      return child(0)
    })
    const p4 = new LocalCliTtsProvider()
    expect(await p4.available()).toBe(true)
  })

  it('CompositeTtsProvider fallbacks', async () => {
    const out = join(dir, 'c.wav')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new Uint8Array([9]).buffer
      }))
    )
    const c = new CompositeTtsProvider('http://tts', 'k')
    expect(await c.available()).toBe(true)
    await c.speak({ text: 'a', outputPath: out })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500 }))
    )
    spawn.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'which') return child(args[0] === 'espeak' ? 0 : 1)
      return child(0)
    })
    await c.speak({ text: 'b', outputPath: join(dir, 'b.wav') })

    const c2 = new CompositeTtsProvider('', '')
    spawn.mockImplementation(() => child(1))
    expect(await c2.available()).toBe(false)
    await expect(
      c2.speak({ text: 'z', outputPath: join(dir, 'z.wav') })
    ).rejects.toMatchObject({ message: 'errors.ttsUnavailable' })
  })

  it('ttsClipPath ensurePathParent fileReady', () => {
    const p = ttsClipPath(dir, 's1', 'e1')
    expect(p).toContain('tts')
    expect(p).toContain('e1.wav')
    ensurePathParent(p)
    expect(fileReady(p)).toBe(false)
    writeFileSync(p, 'x')
    expect(fileReady(p)).toBe(true)
  })
})
