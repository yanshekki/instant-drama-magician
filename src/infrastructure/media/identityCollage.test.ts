import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const spawnSync = vi.fn()
vi.mock('child_process', () => ({
  spawnSync: (...a: unknown[]) => spawnSync(...a)
}))
vi.mock('../ffmpeg/resolveFfmpegPath', () => ({
  resolveFfmpegPath: () => {
    throw new Error('no ffmpeg')
  }
}))

import { stitchIdentityCollage } from './identityCollage'

describe('stitchIdentityCollage', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'id-collage-'))
    spawnSync.mockReset()
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns need-two when fewer than two existing stills', () => {
    const a = join(dir, 'a.png')
    writeFileSync(a, 'x')
    expect(
      stitchIdentityCollage({
        imagePaths: [a],
        outputPath: join(dir, 'out.png'),
        ffmpegBin: 'ffmpeg'
      })
    ).toMatchObject({ stitched: false, reason: 'need-two' })
  })

  it('stitches when ffmpeg writes the plate', () => {
    const a = join(dir, 'a.png')
    const b = join(dir, 'b.png')
    const out = join(dir, 'out.png')
    writeFileSync(a, 'x')
    writeFileSync(b, 'y')
    spawnSync.mockImplementation(() => {
      writeFileSync(out, 'ok')
      return { status: 0, stdout: '', stderr: '' }
    })
    const r = stitchIdentityCollage({
      imagePaths: [a, b],
      outputPath: out,
      ffmpegBin: 'ffmpeg'
    })
    expect(r).toEqual({ path: out, stitched: true })
    expect(existsSync(out)).toBe(true)
    expect(spawnSync).toHaveBeenCalled()
  })

  it('returns ffmpeg-fail when spawn exits non-zero', () => {
    const a = join(dir, 'a.png')
    const b = join(dir, 'b.png')
    writeFileSync(a, 'x')
    writeFileSync(b, 'y')
    spawnSync.mockReturnValue({ status: 1, stdout: '', stderr: 'fail' })
    expect(
      stitchIdentityCollage({
        imagePaths: [a, b],
        outputPath: join(dir, 'out.png'),
        ffmpegBin: 'ffmpeg'
      })
    ).toMatchObject({ stitched: false, reason: 'ffmpeg-fail', path: a })
  })

  it('returns no-ffmpeg when the binary cannot be resolved', () => {
    const a = join(dir, 'a.png')
    const b = join(dir, 'b.png')
    writeFileSync(a, 'x')
    writeFileSync(b, 'y')
    expect(
      stitchIdentityCollage({
        imagePaths: [a, b],
        outputPath: join(dir, 'out.png')
      })
    ).toMatchObject({ stitched: false, reason: 'no-ffmpeg', path: a })
  })
})
