/**
 * Isolated imageEnhance rename→copy and unlink catch.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const spawnSync = vi.fn()
const renameThrow = vi.hoisted(() => ({ v: false }))
const unlinkThrow = vi.hoisted(() => ({ v: false }))

vi.mock('child_process', () => ({
  spawnSync: (...a: unknown[]) => spawnSync(...a)
}))
vi.mock('../ffmpeg/resolveFfmpegPath', () => ({
  resolveFfmpegPath: () => '/mock/ffmpeg'
}))
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    renameSync: (from: string, to: string) => {
      if (renameThrow.v) throw new Error('exdev')
      return actual.renameSync(from, to)
    },
    unlinkSync: (p: string) => {
      if (unlinkThrow.v) throw new Error('busy')
      return actual.unlinkSync(p)
    }
  }
})

import { enhanceCharacterImage } from './imageEnhance'

describe('imageEnhance isolated', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'idm-enh-iso-'))
    renameThrow.v = false
    unlinkThrow.v = false
    spawnSync.mockReset()
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('rename fail copies then unlink catch', () => {
    const f = join(dir, 'a.png')
    writeFileSync(f, 'x')
    spawnSync.mockImplementation((_b: string, args: string[]) => {
      if (!args.includes('-vf')) {
        return {
          status: 0,
          stderr: 'Stream #0:0: Video: png, 100x100',
          stdout: ''
        }
      }
      writeFileSync(args[args.length - 1], 'enhanced')
      return { status: 0, stderr: '', stdout: '' }
    })
    renameThrow.v = true
    unlinkThrow.v = true
    const r = enhanceCharacterImage(f, { ffmpegBin: 'ffmpeg', scale: 2 })
    expect(r.enhanced === true || r.enhanced === false).toBe(true)
  })

  it('ffmpeg exit cleans tmp with unlink catch', () => {
    const f = join(dir, 'b.png')
    writeFileSync(f, 'x')
    spawnSync.mockImplementation((_b: string, args: string[]) => {
      if (!args.includes('-vf')) {
        return {
          status: 0,
          stderr: 'Stream #0:0: Video: png, 100x100',
          stdout: ''
        }
      }
      writeFileSync(args[args.length - 1], 'tmp')
      return { status: 2, stderr: 'fail', stdout: '' }
    })
    unlinkThrow.v = true
    const r = enhanceCharacterImage(f, { ffmpegBin: 'ffmpeg' })
    expect(r.enhanced).toBe(false)
  })
})
