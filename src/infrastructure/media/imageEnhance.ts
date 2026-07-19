/**
 * Post-process Grok Imagine outputs (Node + FFmpeg only — no Python/Pillow).
 *
 * Grok native canvas is often ~1280×720 / 720×1280 / 1024×1024. A mild 2×
 * scale + unsharp makes multi-panel character sheets less soft when displayed
 * large, without inventing new identity detail.
 */

import { spawnSync } from 'child_process'
import { copyFileSync, existsSync, renameSync, unlinkSync } from 'fs'
import { dirname, join } from 'path'
import { resolveFfmpegPath } from '../ffmpeg/resolveFfmpegPath'

/** Upscale if the longest edge is below this (Grok class resolutions). */
export const ENHANCE_MAX_EDGE_BEFORE = 1600
export const ENHANCE_SCALE = 2

export interface EnhanceImageOptions {
  /** Skip when longest edge ≥ this (default 1600) */
  maxEdge?: number
  /** Integer scale factor (default 2) */
  scale?: number
  /** When false, no-op */
  enabled?: boolean
  /** Override ffmpeg binary */
  ffmpegBin?: string
}

function probeImageSize(
  ffmpegBin: string,
  filePath: string
): { w: number; h: number } | null {
  // ffmpeg prints stream info to stderr when probing with -i
  const r = spawnSync(ffmpegBin, ['-hide_banner', '-i', filePath], {
    encoding: 'utf8',
    timeout: 30_000
  })
  const err = `${r.stderr || ''}${r.stdout || ''}`
  const m = err.match(
    /Stream\s+#\d+:\d+(?:\([^)]*\))?:\s+Video:.*?(\d{1,5})x(\d{1,5})/
  )
  if (!m) {
    // broader fallback (avoid matching e.g. "25 fps")
    const m2 = err.match(/\b(\d{1,5})x(\d{1,5})\b/)
    if (!m2) return null
    return { w: Number(m2[1]), h: Number(m2[2]) }
  }
  return { w: Number(m[1]), h: Number(m[2]) }
}

/**
 * In-place enhance of a PNG/JPEG on disk via FFmpeg.
 * Safe no-op if ffmpeg missing, file missing, or already large.
 */
export function enhanceCharacterImage(
  filePath: string,
  options?: EnhanceImageOptions
): {
  path: string
  enhanced: boolean
  before?: string
  after?: string
  reason?: string
} {
  if (options?.enabled === false) {
    return { path: filePath, enhanced: false, reason: 'disabled' }
  }
  if (!filePath || !existsSync(filePath)) {
    return { path: filePath, enhanced: false, reason: 'missing' }
  }

  const maxEdge = options?.maxEdge ?? ENHANCE_MAX_EDGE_BEFORE
  const scale = Math.max(
    1,
    Math.min(4, Math.round(options?.scale ?? ENHANCE_SCALE))
  )

  let ffmpegBin: string
  try {
    ffmpegBin = options?.ffmpegBin?.trim() || resolveFfmpegPath()
  } catch {
    return { path: filePath, enhanced: false, reason: 'no_ffmpeg' }
  }
  if (!ffmpegBin || !existsSync(ffmpegBin)) {
    // resolveFfmpegPath may return bare "ffmpeg" on PATH
    if (ffmpegBin !== 'ffmpeg' && ffmpegBin !== 'ffmpeg.exe') {
      return { path: filePath, enhanced: false, reason: 'no_ffmpeg' }
    }
  }

  const size = probeImageSize(ffmpegBin, filePath)
  if (!size) {
    return { path: filePath, enhanced: false, reason: 'probe_failed' }
  }
  const before = `${size.w}x${size.h}`
  if (Math.max(size.w, size.h) >= maxEdge) {
    return {
      path: filePath,
      enhanced: false,
      reason: 'already_large',
      before
    }
  }

  const nw = size.w * scale
  const nh = size.h * scale
  const tmp = join(dirname(filePath), `.enhance_${Date.now()}.png`)

  // scale + mild unsharp (FFmpeg unsharp filter)
  const vf = `scale=${nw}:${nh}:flags=lanczos,unsharp=5:5:0.8:5:5:0.0`
  const r = spawnSync(
    ffmpegBin,
    [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      filePath,
      '-vf',
      vf,
      '-frames:v',
      '1',
      tmp
    ],
    { encoding: 'utf8', timeout: 60_000 }
  )

  if (r.status !== 0 || !existsSync(tmp)) {
    if (existsSync(tmp)) {
      try {
        unlinkSync(tmp)
      } catch {
        /* ignore */
      }
    }
    return {
      path: filePath,
      enhanced: false,
      reason: `ffmpeg_exit_${r.status}`,
      before,
      after: (r.stderr || r.stdout || '').trim().slice(0, 200)
    }
  }

  try {
    renameSync(tmp, filePath)
  } catch {
    copyFileSync(tmp, filePath)
    try {
      unlinkSync(tmp)
    } catch {
      /* ignore */
    }
  }

  return {
    path: filePath,
    enhanced: true,
    before,
    after: `${nw}x${nh}`
  }
}
