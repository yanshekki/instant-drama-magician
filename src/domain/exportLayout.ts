export type TransitionMode = 'cut' | 'fade'

export interface FrameSize {
  width: number
  height: number
}

/** Map aspect ratio settings to even-numbered export frame size. */
export function resolutionForAspect(aspectRatio: string): FrameSize {
  const key = aspectRatio.trim()
  if (key === '9:16') return { width: 720, height: 1280 }
  if (key === '1:1') return { width: 1080, height: 1080 }
  // default 16:9
  return { width: 1280, height: 720 }
}

export function scalePadFilter(size: FrameSize): string {
  const { width, height } = size
  return [
    `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
    'fps=24',
    'format=yuv420p'
  ].join(',')
}

export interface ClipDuration {
  durationSeconds: number
}

/**
 * Build xfade filter chain for N already-loaded video inputs (0..n-1).
 * Each input is assumed pre-normalized (same size/fps).
 * Returns filter_complex ending in [vout].
 */
export function buildXfadeFilterChain(options: {
  clipDurations: number[]
  transitionSec: number
}): string {
  const durs = options.clipDurations.map((d) => Math.max(0.5, d))
  const t = Math.min(
    Math.max(0.05, options.transitionSec),
    ...durs.map((d) => Math.max(0.05, d / 2))
  )

  if (durs.length === 0) {
    return 'color=c=black:s=1280x720:d=1[vout]'
  }
  if (durs.length === 1) {
    return '[0:v]null[vout]'
  }

  const parts: string[] = []
  let prevLabel = '[0:v]'
  let timeline = durs[0]

  for (let i = 1; i < durs.length; i++) {
    const offset = Math.max(0, timeline - t)
    const outLabel = i === durs.length - 1 ? '[vout]' : `[vx${i}]`
    parts.push(
      `${prevLabel}[${i}:v]xfade=transition=fade:duration=${t.toFixed(3)}:offset=${offset.toFixed(3)}${outLabel}`
    )
    prevLabel = outLabel
    timeline = timeline + durs[i] - t
  }
  return parts.join(';')
}

/** Total output duration after xfade chain. */
export function xfadeTotalDuration(
  clipDurations: number[],
  transitionSec: number
): number {
  if (clipDurations.length === 0) return 0
  const durs = clipDurations.map((d) => Math.max(0.5, d))
  if (durs.length === 1) return durs[0]
  const t = Math.min(
    Math.max(0.05, transitionSec),
    ...durs.map((d) => Math.max(0.05, d / 2))
  )
  return durs.reduce((a, b) => a + b, 0) - t * (durs.length - 1)
}

export interface DuckWindow {
  startSeconds: number
  endSeconds: number
}

/**
 * ffmpeg volume expression: base * duckRatio inside windows, else base.
 * Uses eval=frame with between(t,...).
 */
export function buildDuckVolumeExpression(options: {
  baseVolume: number
  duckRatio: number
  windows: DuckWindow[]
}): string {
  const base = clamp01(options.baseVolume)
  const duck = clamp01(options.duckRatio)
  if (options.windows.length === 0 || duck >= 0.999) {
    return String(base)
  }
  // sum of between() → >0 when inside any window
  const cond = options.windows
    .map((w) => {
      const s = Math.max(0, w.startSeconds).toFixed(3)
      const e = Math.max(w.startSeconds, w.endSeconds).toFixed(3)
      return `between(t\\,${s}\\,${e})`
    })
    .join('+')
  // if(cond, base*duck, base)
  return `${base}*if(${cond}\\,${duck}\\,1)`
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.min(1, Math.max(0, n))
}
