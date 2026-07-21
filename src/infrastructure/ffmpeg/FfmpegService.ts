import { spawn } from 'child_process'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { buildAudioMixFilter, secondsToMs } from '../../domain/audioMix'
import {
  buildXfadeFilterChain,
  resolutionForAspect,
  scalePadFilter,
  type TransitionMode
} from '../../domain/exportLayout'
import { AppError } from '../../types/errors'
import {
  resolveFfmpegPath,
  resolveFfmpegPathFresh
} from './resolveFfmpegPath'

export interface StoryboardClip {
  startTime: number
  endTime: number
  label: string
  dialogue?: string | null
  imagePath?: string | null
  mediaPath?: string | null
}

export class FfmpegService {
  private ffmpegBin: string

  constructor(ffmpegBin?: string) {
    this.ffmpegBin = ffmpegBin?.trim() || resolveFfmpegPath()
  }

  /** Resolved binary path (for diagnostics). */
  get binaryPath(): string {
    return this.ffmpegBin
  }

  async ensureAvailable(): Promise<void> {
    const tryBin = async (bin: string): Promise<boolean> => {
      try {
        await this.run([bin, '-version'], { ignoreOutput: true })
        this.ffmpegBin = bin
        return true
      } catch {
        return false
      }
    }

    if (await tryBin(this.ffmpegBin)) return

    // Re-resolve (handles first-probe race / cwd change / bad cache)
    const fresh = resolveFfmpegPathFresh()
    if (fresh !== this.ffmpegBin && (await tryBin(fresh))) return

    throw new AppError(
      'FFMPEG_UNAVAILABLE',
      'errors.ffmpegNotFound'
    )
  }

  /**
   * Generate a short solid-color clip (stub / fallback).
   * Does NOT use drawtext — johnvansickle/ffmpeg-static builds omit that filter.
   * Optional label is burned via ASS + libass when available; otherwise solid only.
   */
  async makeColorClip(options: {
    outputPath: string
    durationSeconds: number
    label: string
    color?: string
    width?: number
    height?: number
  }): Promise<string> {
    await this.ensureAvailable()
    mkdirSync(dirname(options.outputPath), { recursive: true })
    const duration = Math.max(0.5, options.durationSeconds)
    const color = options.color ?? '0x1e1b4b'
    const w = options.width ?? 1280
    const h = options.height ?? 720
    const label = (options.label || 'clip').slice(0, 80).replace(/\n/g, ' ')

    const baseArgs = [
      this.ffmpegBin,
      '-y',
      '-f',
      'lavfi',
      '-i',
      `color=c=${color}:s=${w}x${h}:d=${duration.toFixed(2)}`,
      '-f',
      'lavfi',
      '-i',
      'anullsrc=channel_layout=stereo:sample_rate=44100'
    ]

    // Prefer ASS (libass) for label — works on builds without drawtext
    const assPath = options.outputPath.replace(/\.mp4$/i, '') + '_label.ass'
    let usedAss = false
    try {
      writeFileSync(assPath, buildCenteredAss(label, w, h, duration), 'utf-8')
      const escaped = assPath
        .replace(/\\/g, '/')
        .replace(/:/g, '\\:')
        .replace(/'/g, "\\'")
      await this.run([
        ...baseArgs,
        '-vf',
        `ass='${escaped}'`,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-shortest',
        '-t',
        duration.toFixed(2),
        options.outputPath
      ])
      usedAss = true
    } catch {
      // Solid color only (always works)
      await this.run([
        ...baseArgs,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-shortest',
        '-t',
        duration.toFixed(2),
        options.outputPath
      ])
    }
    void usedAss

    if (!existsSync(options.outputPath)) {
      throw new AppError('FFMPEG_FAILED', 'errors.ffmpegColorClipMissing')
    }
    return options.outputPath
  }

  /**
   * Concat existing media files; missing paths get a storyboard color segment.
   */
  async exportConcat(options: {
    outDir: string
    fileName: string
    title: string
    clips: StoryboardClip[]
    aspectRatio?: string
  }): Promise<string> {
    await this.ensureAvailable()
    mkdirSync(options.outDir, { recursive: true })
    const size = resolutionForAspect(options.aspectRatio ?? '16:9')

    const clips =
      options.clips.length > 0
        ? options.clips
        : [
            {
              startTime: 0,
              endTime: 3,
              label: options.title,
              dialogue: 'Empty timeline'
            }
          ]

    const segmentPaths: string[] = []
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i]
      const duration = Math.max(0.5, clip.endTime - clip.startTime)
      if (clip.mediaPath && existsSync(clip.mediaPath)) {
        const norm = join(options.outDir, `_norm_${i}_${Date.now()}.mp4`)
        await this.normalizeClip(clip.mediaPath, norm, size, duration)
        segmentPaths.push(norm)
        continue
      }
      const seg = join(options.outDir, `fallback_${i}.mp4`)
      const text =
        [clip.label, clip.dialogue].filter(Boolean).join(' — ').slice(0, 80) ||
        `Clip ${i + 1}`
      await this.makeColorClip({
        outputPath: seg,
        durationSeconds: duration,
        label: text,
        width: size.width,
        height: size.height
      })
      segmentPaths.push(seg)
    }

    return this.concatFiles(segmentPaths, join(options.outDir, options.fileName))
  }

  async exportStoryboard(options: {
    outDir: string
    fileName: string
    title: string
    clips: StoryboardClip[]
    aspectRatio?: string
  }): Promise<string> {
    const clips = options.clips.map((c) => ({ ...c, mediaPath: null }))
    return this.exportConcat({ ...options, clips })
  }

  /**
   * High-quality final export: aspect-aware frame, optional xfade,
   * burn-in SRT, BGM ducking + timed dialogue TTS.
   */
  async exportFinal(options: {
    outDir: string
    fileName: string
    title: string
    clips: StoryboardClip[]
    srtContent?: string | null
    burnSubtitles?: boolean
    includeSilentAudio?: boolean
    profile?: 'fast' | 'balanced'
    bgmPath?: string | null
    bgmVolume?: number
    dialogueVolume?: number
    duckRatio?: number
    dialogueAudioPaths?: Array<{
      path: string
      startSeconds: number
      endSeconds?: number
    }> | null
    aspectRatio?: string
    transitionMode?: TransitionMode
    transitionSec?: number
  }): Promise<string> {
    await this.ensureAvailable()
    mkdirSync(options.outDir, { recursive: true })
    const size = resolutionForAspect(options.aspectRatio ?? '16:9')
    const transitionMode = options.transitionMode ?? 'cut'
    const transitionSec = options.transitionSec ?? 0.3

    const clips =
      options.clips.length > 0
        ? options.clips
        : [
            {
              startTime: 0,
              endTime: 3,
              label: options.title,
              dialogue: 'Empty timeline'
            }
          ]

    const durations = clips.map((c) => Math.max(0.5, c.endTime - c.startTime))
    const segmentPaths: string[] = []
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i]
      const duration = durations[i]
      if (clip.mediaPath && existsSync(clip.mediaPath)) {
        const norm = join(options.outDir, `_fnorm_${i}_${Date.now()}.mp4`)
        await this.normalizeClip(clip.mediaPath, norm, size, duration)
        segmentPaths.push(norm)
      } else {
        const seg = join(options.outDir, `_ffallback_${i}_${Date.now()}.mp4`)
        const text =
          [clip.label, clip.dialogue].filter(Boolean).join(' — ').slice(0, 80) ||
          `Clip ${i + 1}`
        await this.makeColorClip({
          outputPath: seg,
          durationSeconds: duration,
          label: text,
          width: size.width,
          height: size.height
        })
        segmentPaths.push(seg)
      }
    }

    const rawPath = join(options.outDir, `_raw_${Date.now()}.mp4`)
    if (transitionMode === 'fade' && segmentPaths.length > 1) {
      await this.assembleXfade(segmentPaths, durations, transitionSec, rawPath)
    } else {
      await this.concatFiles(segmentPaths, rawPath)
    }

    const crf = options.profile === 'fast' ? '28' : '23'
    const outputPath = join(options.outDir, options.fileName)
    const vfParts = [scalePadFilter(size)]

    if (options.burnSubtitles && options.srtContent && options.srtContent.trim()) {
      const srtPath = join(options.outDir, `_subs_${Date.now()}.srt`)
      writeFileSync(srtPath, options.srtContent, 'utf-8')
      const escaped = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")
      vfParts.push(`subtitles='${escaped}'`)
    }

    const dialogue = (options.dialogueAudioPaths ?? []).filter(
      (d) => d.path && existsSync(d.path)
    )
    const hasBgm = Boolean(options.bgmPath && existsSync(options.bgmPath))
    const needsAudio =
      hasBgm || dialogue.length > 0 || options.includeSilentAudio !== false
    const vol = Math.min(1, Math.max(0, options.bgmVolume ?? 0.25))
    const dVol = Math.min(1, Math.max(0, options.dialogueVolume ?? 1))
    const duckRatio = Math.min(1, Math.max(0, options.duckRatio ?? 0.35))

    const duckWindows = dialogue.map((d) => ({
      startSeconds: d.startSeconds,
      endSeconds:
        d.endSeconds ??
        d.startSeconds + 4
    }))

    const args: string[] = [this.ffmpegBin, '-y', '-i', rawPath]

    if (hasBgm) {
      args.push('-stream_loop', '-1', '-i', options.bgmPath!)
    } else if (needsAudio) {
      args.push(
        '-f',
        'lavfi',
        '-i',
        'anullsrc=channel_layout=stereo:sample_rate=44100'
      )
    }

    for (const d of dialogue) {
      args.push('-i', d.path)
    }

    args.push(
      '-vf',
      vfParts.join(','),
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      crf
    )

    if (needsAudio) {
      const filter = buildAudioMixFilter({
        bgmVolume: hasBgm ? vol : 0,
        dialogueVolume: dVol,
        dialogueStartsMs: dialogue.map((d) => secondsToMs(d.startSeconds)),
        duckWindows: hasBgm && dialogue.length > 0 ? duckWindows : [],
        duckRatio
      })
      args.push(
        '-filter_complex',
        filter,
        '-map',
        '0:v',
        '-map',
        '[a]',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-shortest'
      )
    } else {
      args.push('-an')
    }

    // moov at start — more reliable for VLC / progressive open
    args.push('-movflags', '+faststart', outputPath)
    await this.run(args)

    if (!existsSync(outputPath)) {
      throw new AppError('FFMPEG_FAILED', 'errors.ffmpegFinalMissing')
    }
    return outputPath
  }

  private async normalizeClip(
    inputPath: string,
    outputPath: string,
    size: { width: number; height: number },
    durationSeconds: number
  ): Promise<void> {
    await this.run([
      this.ffmpegBin,
      '-y',
      '-i',
      inputPath,
      '-vf',
      scalePadFilter(size),
      '-t',
      durationSeconds.toFixed(2),
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-an',
      outputPath
    ])
    if (!existsSync(outputPath)) {
      throw new AppError('FFMPEG_FAILED', 'errors.ffmpegNormalizeFailed')
    }
  }

  private async assembleXfade(
    paths: string[],
    durations: number[],
    transitionSec: number,
    outputPath: string
  ): Promise<void> {
    const args: string[] = [this.ffmpegBin, '-y']
    for (const p of paths) {
      args.push('-i', p)
    }
    const fc = buildXfadeFilterChain({
      clipDurations: durations,
      transitionSec
    })
    args.push(
      '-filter_complex',
      fc,
      '-map',
      '[vout]',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      outputPath
    )
    await this.run(args)
    if (!existsSync(outputPath)) {
      // fallback to concat if xfade unsupported
      await this.concatFiles(paths, outputPath)
    }
  }

  /**
   * Grab a single still frame from a video (for continuity / storyboard).
   * Prefers a near-start frame so it matches video-prep keyframe usage.
   */
  async extractStillFrame(options: {
    videoPath: string
    outputPath: string
    /** Seek position in seconds (default 0.25). */
    atSeconds?: number
  }): Promise<string> {
    await this.ensureAvailable()
    if (!existsSync(options.videoPath)) {
      throw new AppError('NOT_FOUND', `Video not found: ${options.videoPath}`)
    }
    mkdirSync(dirname(options.outputPath), { recursive: true })
    const at = Math.max(0, options.atSeconds ?? 0.25)
    // -ss before -i is fast; one png frame (-update 1 for modern ffmpeg)
    const extractArgs = (withSeek: boolean): string[] => [
      this.ffmpegBin,
      '-y',
      ...(withSeek ? (['-ss', at.toFixed(2)] as string[]) : []),
      '-i',
      options.videoPath,
      '-frames:v',
      '1',
      '-update',
      '1',
      '-q:v',
      '2',
      options.outputPath
    ]
    try {
      await this.run(extractArgs(true))
    } catch {
      /* retry without seek / without -update below */
    }
    if (!existsSync(options.outputPath)) {
      try {
        await this.run(extractArgs(false))
      } catch {
        /* fallback without -update for older builds */
        await this.run([
          this.ffmpegBin,
          '-y',
          '-i',
          options.videoPath,
          '-frames:v',
          '1',
          '-q:v',
          '2',
          options.outputPath
        ])
      }
    }
    if (!existsSync(options.outputPath)) {
      throw new AppError(
        'FFMPEG_FAILED',
        'errors.ffmpegStillExtractFailed'
      )
    }
    return options.outputPath
  }

  private async concatFiles(paths: string[], outputPath: string): Promise<string> {
    const listFile = `${outputPath}.concat.txt`
    writeFileSync(
      listFile,
      paths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'),
      'utf-8'
    )
    await this.run([
      this.ffmpegBin,
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listFile,
      '-c',
      'copy',
      outputPath
    ])
    if (!existsSync(outputPath)) {
      await this.run([
        this.ffmpegBin,
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listFile,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        outputPath
      ])
    }
    if (!existsSync(outputPath)) {
      throw new AppError('FFMPEG_FAILED', 'errors.ffmpegExportMissing')
    }
    return outputPath
  }

  private run(
    args: string[],
    opts?: { ignoreOutput?: boolean }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const bin = args[0]
      const rest = args.slice(1)
      const child = spawn(bin, rest, { stdio: opts?.ignoreOutput ? 'ignore' : 'pipe' })
      let stderr = ''
      child.stderr?.on('data', (d: Buffer) => {
        stderr += d.toString()
      })
      child.on('error', (err) => {
        reject(
          new AppError('FFMPEG_FAILED', `Failed to spawn ffmpeg: ${err.message}`)
        )
      })
      child.on('close', (code) => {
        if (code === 0) resolve()
        else {
          reject(
            new AppError(
              'FFMPEG_FAILED',
              `ffmpeg exited with code ${code}`,
              stderr.slice(-2000)
            )
          )
        }
      })
    })
  }
}

/** Minimal ASS for centered white title (uses libass, not drawtext). */
function buildCenteredAss(
  text: string,
  w: number,
  h: number,
  durationSec: number
): string {
  const safe = text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, ' ')
  const end = formatAssTime(durationSec)
  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${w}`,
    `PlayResY: ${h}`,
    'WrapStyle: 0',
    '',
    '[V4+ Styles]',
    // Name, Fontname, Fontsize, Primary, Secondary, Outline, Back, Bold, Italic, ... Alignment=5 center
    'Style: Default,DejaVu Sans,36,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,0,5,40,40,40,1',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    `Dialogue: 0,0:00:00.00,${end},Default,,0,0,0,,${safe}`,
    ''
  ].join('\n')
}

function formatAssTime(sec: number): string {
  const s = Math.max(0.1, sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const whole = Math.floor(s % 60)
  const cs = Math.floor((s % 1) * 100)
  return `${h}:${String(m).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

