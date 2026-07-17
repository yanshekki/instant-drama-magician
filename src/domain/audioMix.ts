/**
 * Build ffmpeg filter_complex for BGM + timed dialogue stems.
 *
 * Input layout assumed by callers:
 *   0 = video
 *   1 = BGM or silent anullsrc
 *   2.. = dialogue audio files (optional)
 */
export function buildAudioMixFilter(options: {
  bgmVolume: number
  dialogueVolume: number
  /** Delay each dialogue stem in milliseconds (timeline start). */
  dialogueStartsMs: number[]
}): string {
  const bgVol = clamp01(options.bgmVolume)
  const dVol = clamp01(options.dialogueVolume)
  const delays = options.dialogueStartsMs.map((ms) => Math.max(0, Math.round(ms)))
  const parts: string[] = [`[1:a]volume=${bgVol}[bg]`]
  const mixLabels = ['[bg]']

  for (let i = 0; i < delays.length; i++) {
    const delay = delays[i]
    parts.push(
      `[${i + 2}:a]adelay=${delay}|${delay},volume=${dVol}[d${i}]`
    )
    mixLabels.push(`[d${i}]`)
  }

  if (mixLabels.length === 1) {
    parts.push('[bg]apad[a]')
  } else {
    parts.push(
      `${mixLabels.join('')}amix=inputs=${mixLabels.length}:duration=first:dropout_transition=2,apad[a]`
    )
  }
  return parts.join(';')
}

export function secondsToMs(seconds: number): number {
  return Math.max(0, Math.round(seconds * 1000))
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.min(1, Math.max(0, n))
}
