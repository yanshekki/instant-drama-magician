import { spawn } from 'child_process'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { AppError } from '../../types/errors'

export interface StoryboardClip {
  startTime: number
  endTime: number
  label: string
  dialogue?: string | null
  imagePath?: string | null
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

  /**
   * Build a simple storyboard MP4 from timeline labels (color clips + drawtext).
   * MVP: no external images required.
   */
  async exportStoryboard(options: {
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

    // Generate a concat list of short color segments with drawtext
    const segmentPaths: string[] = []
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i]
      const duration = Math.max(0.5, clip.endTime - clip.startTime)
      const seg = join(options.outDir, `seg_${i}.mp4`)
      const text = sanitizeDrawText(
        [clip.label, clip.dialogue].filter(Boolean).join(' — ').slice(0, 80) ||
          `Clip ${i + 1}`
      )
      await this.run([
        this.ffmpegBin,
        '-y',
        '-f',
        'lavfi',
        '-i',
        `color=c=0x1e1b4b:s=1280x720:d=${duration.toFixed(2)}`,
        '-vf',
        `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='${text}':fontcolor=white:fontsize=28:x=(w-text_w)/2:y=(h-text_h)/2`,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-t',
        duration.toFixed(2),
        seg
      ])
      segmentPaths.push(seg)
    }

    const listFile = join(options.outDir, 'concat.txt')
    writeFileSync(
      listFile,
      segmentPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'),
      'utf-8'
    )

    const outputPath = join(options.outDir, options.fileName)
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
