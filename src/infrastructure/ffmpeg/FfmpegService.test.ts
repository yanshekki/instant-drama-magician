import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'
import { mkdtempSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const spawnMock = vi.fn()

vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args)
}))

vi.mock('./resolveFfmpegPath', () => ({
  resolveFfmpegPath: () => '/mock/ffmpeg',
  resolveFfmpegPathFresh: () => '/mock/ffmpeg-fresh'
}))

import { FfmpegService } from './FfmpegService'

function makeChild(opts?: {
  code?: number
  error?: Error
  stderr?: string
  writeOutput?: string
}) {
  const child = new EventEmitter() as EventEmitter & {
    stderr: EventEmitter
  }
  child.stderr = new EventEmitter()
  queueMicrotask(() => {
    if (opts?.stderr) child.stderr.emit('data', Buffer.from(opts.stderr))
    if (opts?.writeOutput) {
      try {
        mkdirSync(join(opts.writeOutput, '..'), { recursive: true })
      } catch {
        /* */
      }
      try {
        writeFileSync(opts.writeOutput, 'x')
      } catch {
        /* path may be file */
        try {
          writeFileSync(opts.writeOutput, 'x')
        } catch {
          /* ignore */
        }
      }
    }
    if (opts?.error) child.emit('error', opts.error)
    else child.emit('close', opts?.code ?? 0)
  })
  return child
}

/** spawn that creates the last arg as output file when code 0 */
function installSpawnSuccess(opts?: {
  failAss?: boolean
  failFirstN?: number
  failCodes?: number[]
}) {
  let n = 0
  spawnMock.mockImplementation((bin: string, args: string[]) => {
    n++
    const out = args[args.length - 1]
    const failAss =
      opts?.failAss && args.some((a) => String(a).includes('ass='))
    const failN = opts?.failFirstN != null && n <= opts.failFirstN
    const code = failAss || failN ? 1 : 0
    if (code === 0 && typeof out === 'string' && out.endsWith('.mp4')) {
      try {
        mkdirSync(join(out, '..'), { recursive: true })
      } catch {
        /* */
      }
      writeFileSync(out, 'mp4')
    }
    if (code === 0 && typeof out === 'string' && out.endsWith('.png')) {
      try {
        mkdirSync(join(out, '..'), { recursive: true })
      } catch {
        /* */
      }
      writeFileSync(out, 'png')
    }
    return makeChild({ code })
  })
}

describe('FfmpegService', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ff-'))
    spawnMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* */
    }
  })

  it('exposes binaryPath and uses constructor override', () => {
    const ff = new FfmpegService('/custom/ffmpeg')
    expect(ff.binaryPath).toBe('/custom/ffmpeg')
    const def = new FfmpegService()
    expect(def.binaryPath).toBe('/mock/ffmpeg')
    const empty = new FfmpegService('  ')
    expect(empty.binaryPath).toBe('/mock/ffmpeg')
  })

  it('ensureAvailable succeeds on first bin', async () => {
    installSpawnSuccess()
    const ff = new FfmpegService('/mock/ffmpeg')
    await expect(ff.ensureAvailable()).resolves.toBeUndefined()
  })

  it('ensureAvailable retries with fresh path then throws', async () => {
    let n = 0
    spawnMock.mockImplementation(() => {
      n++
      return makeChild({ code: 1, stderr: 'nope' })
    })
    const ff = new FfmpegService('/bad')
    await expect(ff.ensureAvailable()).rejects.toMatchObject({
      code: 'FFMPEG_UNAVAILABLE'
    })
    expect(n).toBeGreaterThanOrEqual(2)
  })

  it('ensureAvailable recovers via fresh path', async () => {
    let n = 0
    spawnMock.mockImplementation((bin: string) => {
      n++
      if (bin === '/mock/ffmpeg-fresh') return makeChild({ code: 0 })
      return makeChild({ code: 1 })
    })
    const ff = new FfmpegService('/bad-bin')
    await ff.ensureAvailable()
    expect(ff.binaryPath).toBe('/mock/ffmpeg-fresh')
    expect(n).toBeGreaterThanOrEqual(2)
  })

  it('makeColorClip with ASS success and fallback', async () => {
    installSpawnSuccess()
    const ff = new FfmpegService()
    const out = join(dir, 'c1.mp4')
    await expect(
      ff.makeColorClip({
        outputPath: out,
        durationSeconds: 0.1,
        label: 'Hello\nWorld{x}'
      })
    ).resolves.toBe(out)
    expect(existsSync(out)).toBe(true)

    // ASS fail → solid
    installSpawnSuccess({ failAss: true })
    const out2 = join(dir, 'c2.mp4')
    await ff.makeColorClip({
      outputPath: out2,
      durationSeconds: 1,
      label: 'L',
      color: '0x000000',
      width: 640,
      height: 360
    })
    expect(existsSync(out2)).toBe(true)
  })

  it('makeColorClip throws when output missing', async () => {
    spawnMock.mockImplementation(() => makeChild({ code: 0 }))
    const ff = new FfmpegService()
    await expect(
      ff.makeColorClip({
        outputPath: join(dir, 'missing.mp4'),
        durationSeconds: 1,
        label: 'x'
      })
    ).rejects.toMatchObject({ code: 'FFMPEG_FAILED' })
  })

  it('exportConcat empty clips and media path', async () => {
    installSpawnSuccess()
    const ff = new FfmpegService()
    const media = join(dir, 'in.mp4')
    writeFileSync(media, 'v')
    const outDir = join(dir, 'exp')
    const path = await ff.exportConcat({
      outDir,
      fileName: 'out.mp4',
      title: 'T',
      clips: [
        {
          startTime: 0,
          endTime: 2,
          label: 'A',
          dialogue: 'hi',
          mediaPath: media
        },
        { startTime: 0, endTime: 1, label: 'B', mediaPath: '/no/such' }
      ]
    })
    expect(path).toContain('out.mp4')

    await ff.exportConcat({
      outDir,
      fileName: 'empty.mp4',
      title: 'Empty',
      clips: []
    })

    await ff.exportStoryboard({
      outDir,
      fileName: 'sb.mp4',
      title: 'SB',
      clips: [{ startTime: 0, endTime: 1, label: 's', mediaPath: media }]
    })
  })

  it('exportFinal covers fade, cut, audio, subs, profiles', async () => {
    installSpawnSuccess()
    const ff = new FfmpegService()
    const outDir = join(dir, 'final')
    const media = join(dir, 'm.mp4')
    writeFileSync(media, 'v')
    const bgm = join(dir, 'bgm.mp3')
    writeFileSync(bgm, 'a')
    const dlg = join(dir, 'd.wav')
    writeFileSync(dlg, 'a')

    await ff.exportFinal({
      outDir,
      fileName: 'f1.mp4',
      title: 'T',
      clips: [
        { startTime: 0, endTime: 2, label: 'A', mediaPath: media },
        { startTime: 0, endTime: 2, label: 'B', dialogue: 'x' }
      ],
      transitionMode: 'fade',
      transitionSec: 0.2,
      burnSubtitles: true,
      srtContent: '1\n00:00:00,000 --> 00:00:01,000\nhi\n',
      profile: 'fast',
      bgmPath: bgm,
      bgmVolume: 0.5,
      dialogueVolume: 0.8,
      duckRatio: 0.3,
      dialogueAudioPaths: [
        { path: dlg, startSeconds: 0.5, endSeconds: 1.5 },
        { path: '/missing.wav', startSeconds: 0 }
      ],
      includeSilentAudio: true,
      aspectRatio: '9:16'
    })

    await ff.exportFinal({
      outDir,
      fileName: 'f2.mp4',
      title: 'T2',
      clips: [],
      transitionMode: 'cut',
      profile: 'balanced',
      burnSubtitles: false,
      includeSilentAudio: false,
      bgmPath: '/nope',
      dialogueAudioPaths: null
    })
  })

  it('exportFinal throws when output missing', async () => {
    spawnMock.mockImplementation(() => makeChild({ code: 0 }))
    const ff = new FfmpegService()
    await expect(
      ff.exportFinal({
        outDir: join(dir, 'x'),
        fileName: 'no.mp4',
        title: 't',
        clips: [{ startTime: 0, endTime: 1, label: 'a' }]
      })
    ).rejects.toMatchObject({ code: 'FFMPEG_FAILED' })
  })

  it('extractStillFrame retries and fails', async () => {
    const video = join(dir, 'v.mp4')
    writeFileSync(video, 'v')
    let n = 0
    spawnMock.mockImplementation((_b: string, args: string[]) => {
      if (args.includes('-version')) return makeChild({ code: 0 })
      n++
      const out = args[args.length - 1]
      // fail first two extract attempts, succeed third
      if (n < 3) return makeChild({ code: 1 })
      writeFileSync(out, 'png')
      return makeChild({ code: 0 })
    })
    const ff = new FfmpegService('/mock/ffmpeg')
    const out = join(dir, 'still.png')
    await expect(
      ff.extractStillFrame({ videoPath: video, outputPath: out, atSeconds: -1 })
    ).resolves.toBe(out)

    await expect(
      ff.extractStillFrame({
        videoPath: join(dir, 'missing.mp4'),
        outputPath: join(dir, 's2.png')
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    spawnMock.mockImplementation((_b: string, args: string[]) => {
      if (args.includes('-version')) return makeChild({ code: 0 })
      return makeChild({ code: 1 })
    })
    await expect(
      ff.extractStillFrame({
        videoPath: video,
        outputPath: join(dir, 'fail.png')
      })
    ).rejects.toMatchObject({ code: 'FFMPEG_FAILED' })
  })

  it('concatFiles re-encodes when copy fails and spawn error', async () => {
    let n = 0
    spawnMock.mockImplementation((_b: string, args: string[]) => {
      n++
      const out = args[args.length - 1]
      // version probes
      if (args.includes('-version')) return makeChild({ code: 0 })
      // first concat copy fails to produce file, second reencode succeeds
      if (String(out).endsWith('.mp4') && !args.includes('libx264')) {
        return makeChild({ code: 0 }) // no file written
      }
      if (String(out).endsWith('.mp4')) {
        writeFileSync(out, 'ok')
        return makeChild({ code: 0 })
      }
      // color clips
      if (args.includes('lavfi')) {
        writeFileSync(out, 'ok')
        return makeChild({ code: 0 })
      }
      return makeChild({ code: 0 })
    })
    const ff = new FfmpegService()
    const outDir = join(dir, 'c')
    await ff.exportConcat({
      outDir,
      fileName: 're.mp4',
      title: 't',
      clips: [{ startTime: 0, endTime: 1, label: 'a' }]
    })

    spawnMock.mockImplementation(() =>
      makeChild({ error: new Error('enoent') })
    )
    await expect(ff.ensureAvailable()).rejects.toMatchObject({
      code: 'FFMPEG_UNAVAILABLE'
    })
  })

  it('assembleXfade falls back to concat when output missing', async () => {
    let n = 0
    spawnMock.mockImplementation((_b: string, args: string[]) => {
      n++
      if (args.includes('-version')) return makeChild({ code: 0 })
      const out = args[args.length - 1]
      // xfade: has filter_complex with xfade-like and multiple -i — first raw fails
      if (
        args.includes('-filter_complex') &&
        args.includes('[vout]') &&
        String(out).includes('_raw_')
      ) {
        return makeChild({ code: 0 }) // no file → fallback concat
      }
      if (typeof out === 'string' && out.endsWith('.mp4')) {
        writeFileSync(out, 'ok')
      }
      return makeChild({ code: 0 })
    })
    const ff = new FfmpegService()
    await ff.exportFinal({
      outDir: join(dir, 'xf'),
      fileName: 'x.mp4',
      title: 't',
      clips: [
        { startTime: 0, endTime: 1, label: 'a' },
        { startTime: 0, endTime: 1, label: 'b' }
      ],
      transitionMode: 'fade'
    })
    expect(n).toBeGreaterThan(0)
  })

  it('run rejects non-zero with stderr', async () => {
    spawnMock.mockImplementation(() =>
      makeChild({ code: 9, stderr: 'bad args' })
    )
    const ff = new FfmpegService()
    await expect(ff.ensureAvailable()).rejects.toBeTruthy()
  })

  it('force100 missing output throws for final normalize still export', async () => {
    // spawn succeeds but never writes output files
    spawnMock.mockImplementation(() => makeChild({ code: 0 }))
    const ff = new FfmpegService()
    const media = join(dir, 'in.mp4')
    writeFileSync(media, 'v')
    await expect(
      ff.exportFinal({
        outDir: join(dir, 'f-miss'),
        fileName: 'no-write.mp4',
        title: 'T',
        clips: [
          {
            startTime: 0,
            endTime: 1,
            label: 'A',
            mediaPath: media
          }
        ]
      })
    ).rejects.toMatchObject({ code: 'FFMPEG_FAILED' })
  })

})
