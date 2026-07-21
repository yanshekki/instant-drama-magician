/**
 * Isolated Ffmpeg missing-output residual (vi.mock spawn).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const spawnMock = vi.fn()
vi.mock('child_process', () => ({
  spawn: (...a: unknown[]) => spawnMock(...a)
}))
vi.mock('./resolveFfmpegPath', () => ({
  resolveFfmpegPath: () => '/mock/ffmpeg',
  resolveFfmpegPathFresh: () => '/mock/ffmpeg'
}))

import { FfmpegService } from './FfmpegService'

function emptyChild() {
  const child = new EventEmitter() as EventEmitter & { stderr: EventEmitter }
  child.stderr = new EventEmitter()
  queueMicrotask(() => child.emit('close', 0))
  return child
}

describe('FfmpegService isolated missing output', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'idm-ff-iso-'))
    spawnMock.mockReset()
    spawnMock.mockImplementation(() => emptyChild())
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('extractStillFrame throws when output missing after run', async () => {
    const ff = new FfmpegService()
    const media = join(dir, 'in.mp4')
    writeFileSync(media, 'v')
    await expect(
      ff.extractStillFrame({
        videoPath: media,
        outputPath: join(dir, 'still.png'),
        atSeconds: 0.1
      })
    ).rejects.toMatchObject({ code: 'FFMPEG_FAILED' })
  })

  it('exportConcat unlabeled clips then missing throws', async () => {
    const ff = new FfmpegService()
    const c1 = join(dir, 'c1.mp4')
    const c2 = join(dir, 'c2.mp4')
    writeFileSync(c1, 'a')
    writeFileSync(c2, 'b')
    await expect(
      ff.exportConcat({
        outDir: join(dir, 'cat'),
        fileName: 'out.mp4',
        clips: [
          { startTime: 0, endTime: 1, mediaPath: c1 },
          { startTime: 1, endTime: 2, mediaPath: c2 }
        ]
      } as never)
    ).rejects.toBeTruthy()
  })

  it('exportFinal unlabeled clips missing output', async () => {
    const ff = new FfmpegService()
    const c1 = join(dir, 'a.mp4')
    writeFileSync(c1, 'v')
    await expect(
      ff.exportFinal({
        outDir: join(dir, 'fin'),
        fileName: 'f.mp4',
        title: 'T',
        clips: [{ startTime: 0, endTime: 1, mediaPath: c1 }]
      } as never)
    ).rejects.toMatchObject({ code: 'FFMPEG_FAILED' })
  })
})
