import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const spawnSync = vi.fn()
vi.mock('child_process', () => ({
  spawnSync: (...a: unknown[]) => spawnSync(...a)
}))
vi.mock('../ffmpeg/resolveFfmpegPath', () => ({
  resolveFfmpegPath: () => '/mock/ffmpeg'
}))

import { enhanceCharacterImage, ENHANCE_MAX_EDGE_BEFORE } from './imageEnhance'

describe('imageEnhance', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'enh-'))
    spawnSync.mockReset()
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('disabled / missing / no ffmpeg / probe / already large / success', () => {
    const f = join(dir, 'a.png')
    writeFileSync(f, 'x')
    writeFileSync(join(dir, 'ffmpeg'), 'x')

    expect(
      enhanceCharacterImage(f, { enabled: false })
    ).toMatchObject({ enhanced: false, reason: 'disabled' })
    expect(enhanceCharacterImage('', {})).toMatchObject({
      reason: 'missing'
    })
    expect(
      enhanceCharacterImage(join(dir, 'no.png'))
    ).toMatchObject({ reason: 'missing' })

    expect(
      enhanceCharacterImage(f, { ffmpegBin: join(dir, 'no-bin') })
    ).toMatchObject({ reason: 'no_ffmpeg' })

    // bare ffmpeg name allowed even if not exists
    spawnSync.mockReturnValue({
      status: 0,
      stderr: 'Stream #0:0: Video: png, 100x100',
      stdout: ''
    })
    // probe only path - then enhance fails
    spawnSync
      .mockReturnValueOnce({
        status: 0,
        stderr: 'no size here',
        stdout: ''
      })
    expect(
      enhanceCharacterImage(f, { ffmpegBin: 'ffmpeg' })
    ).toMatchObject({ reason: 'probe_failed' })

    spawnSync.mockReturnValueOnce({
      status: 0,
      stderr: 'Stream #0:0(eng): Video: h264, 2000x1000',
      stdout: ''
    })
    expect(
      enhanceCharacterImage(f, {
        ffmpegBin: 'ffmpeg',
        maxEdge: ENHANCE_MAX_EDGE_BEFORE
      })
    ).toMatchObject({ reason: 'already_large' })

    // broader fallback match
    spawnSync
      .mockReturnValueOnce({
        status: 0,
        stderr: 'size 640x360 fps',
        stdout: ''
      })
      .mockReturnValueOnce({
        status: 1,
        stderr: 'fail',
        stdout: ''
      })
    expect(
      enhanceCharacterImage(f, { ffmpegBin: 'ffmpeg', scale: 2 })
    ).toMatchObject({ enhanced: false })

    // success with rename
    const tmpProbe = {
      status: 0,
      stderr: 'Stream #0:0: Video: png, 320x180',
      stdout: ''
    }
    spawnSync.mockImplementation((bin: string, args: string[]) => {
      if (args.includes('-i') && args[args.length - 1] !== undefined && !args.includes('-vf')) {
        return tmpProbe
      }
      // enhance write tmp
      const out = args[args.length - 1]
      writeFileSync(out, 'png')
      return { status: 0, stderr: '', stdout: '' }
    })
    // Actually probe uses -i filePath without -vf; enhance has -vf
    spawnSync.mockImplementation((_b: string, args: string[]) => {
      if (!args.includes('-vf')) {
        return {
          status: 0,
          stderr: 'Stream #0:0: Video: png, 320x180',
          stdout: ''
        }
      }
      writeFileSync(args[args.length - 1], 'out')
      return { status: 0, stderr: '', stdout: '' }
    })
    expect(
      enhanceCharacterImage(f, { ffmpegBin: 'ffmpeg', scale: 2 })
    ).toMatchObject({ enhanced: true, before: '320x180' })

    // ffmpeg exit with leftover tmp
    spawnSync.mockImplementation((_b: string, args: string[]) => {
      if (!args.includes('-vf')) {
        return {
          status: 0,
          stderr: 'Stream #0:0: Video: png, 100x100',
          stdout: ''
        }
      }
      writeFileSync(args[args.length - 1], 'tmp')
      return { status: 2, stderr: 'err', stdout: '' }
    })
    expect(
      enhanceCharacterImage(f, { ffmpegBin: 'ffmpeg' })
    ).toMatchObject({ enhanced: false })
  })

  it('resolveFfmpegPath throw', async () => {
    vi.resetModules()
    vi.doMock('../ffmpeg/resolveFfmpegPath', () => ({
      resolveFfmpegPath: () => {
        throw new Error('no')
      }
    }))
    vi.doMock('child_process', () => ({ spawnSync }))
    const { enhanceCharacterImage: enh } = await import('./imageEnhance')
    const f = join(dir, 'b.png')
    writeFileSync(f, 'x')
    expect(enh(f)).toMatchObject({ reason: 'no_ffmpeg' })
  })
})
