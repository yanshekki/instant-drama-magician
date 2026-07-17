import { spawn } from 'child_process'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { basename, dirname, join } from 'path'
import { buildAudioMixFilter, secondsToMs } from '../../domain/audioMix'
import { AppError } from '../../types/errors'

export interface StoryboardClip {
  startTime: number
  endTime: number
  label: string
  dialogue?: string | null
  imagePath?: string | null
  mediaPath?: string | null
}

export class FfmpegService {
  constructor(private readonly ffmpegBin = process.env.FFMPEG_PATH ?? 'ffmpeg') {}

  async ensureAvailable(): Promise<void> {
    try {
      await this.run([this.ffmpegBin, '-version'], { ignoreOutput: true })
    } catch {
      throw new AppError(
        'FFMPEG_UNAVAILABLE',
        'FFmpeg not found. Install ffmpeg or set FFMPEG_PATH.'
      )
    }
  }

  /** Generate a short solid-color clip (stub / fallback). */
  async makeColorClip(options: {
    outputPath: string
    durationSeconds: number
    label: string
    color?: string
  }): Promise<string> {
    await this.ensureAvailable()
    mkdirSync(dirname(options.outputPath), { recursive: true })
    const duration = Math.max(0.5, options.durationSeconds)
    const text = sanitizeDrawText(options.label.slice(0, 80) || 'clip')
    const color = options.color ?? '0x1e1b4b'
    await this.run([
      this.ffmpegBin,
      '-y',
      '-f',
      'lavfi',
      '-i',
      `color=c=${color}:s=1280x720:d=${duration.toFixed(2)}`,
      '-vf',
      `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='${text}':fontcolor=white:fontsize=28:x=(w-text_w)/2:y=(h-text_h)/2`,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-t',
      duration.toFixed(2),
      options.outputPath
    ])
    if (!existsSync(options.outputPath)) {
      throw new AppError('FFMPEG_FAILED', 'Color clip missing after encode')
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
  }): Promise<string> {
    await this.ensureAvailable()
    mkdirSync(options.outDir, { recursive: true })

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
        segmentPaths.push(clip.mediaPath)
        continue
      }
      const seg = join(options.outDir, `fallback_${i}.mp4`)
      const text = sanitizeDrawText(
        [clip.label, clip.dialogue].filter(Boolean).join(' — ').slice(0, 80) ||
          `Clip ${i + 1}`
      )
      await this.makeColorClip({
        outputPath: seg,
        durationSeconds: duration,
        label: text
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
  }): Promise<string> {
    // Storyboard always synthesizes color segments (ignore existing media)
    const clips = options.clips.map((c) => ({ ...c, mediaPath: null }))
    return this.exportConcat({ ...options, clips })
  }

  /**
   * High-quality final export: normalize clips, optional burn-in SRT,
   * BGM + timed dialogue TTS stems.
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
    dialogueAudioPaths?: Array<{ path: string; startSeconds: number }> | null
  }): Promise<string> {
    await this.ensureAvailable()
    mkdirSync(options.outDir, { recursive: true })

    // First assemble visual track via concat (with fallbacks)
    const rawPath = join(options.outDir, `_raw_${Date.now()}.mp4`)
    await this.exportConcat({
      outDir: options.outDir,
      fileName: basename(rawPath),
      title: options.title,
      clips: options.clips
    })

    const crf = options.profile === 'fast' ? '28' : '23'
    const outputPath = join(options.outDir, options.fileName)
    const vfParts = [
      'scale=1280:720:force_original_aspect_ratio=decrease',
      'pad=1280:720:(ow-iw)/2:(oh-ih)/2',
      'fps=24'
    ]

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
        dialogueStartsMs: dialogue.map((d) => secondsToMs(d.startSeconds))
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
        '-shortest'
      )
    } else {
      args.push('-an')
    }

    args.push(outputPath)
    await this.run(args)

    if (!existsSync(outputPath)) {
      throw new AppError('FFMPEG_FAILED', 'Final export missing output file')
    }
    return outputPath
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
      // re-encode fallback if stream copy fails
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
      throw new AppError('FFMPEG_FAILED', 'Export finished but output file missing')
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

function sanitizeDrawText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/\n/g, ' ')
}
