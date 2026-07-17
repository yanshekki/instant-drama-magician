/** Grok gateway only accepts image_to_video / video seconds of 6 or 10. */
export type GrokVideoSeconds = 6 | 10

/**
 * Snap arbitrary duration to Grok-allowed video lengths.
 * Same rule as Grok-Cli-to-OpenAI-compatible: >= 8 → 10, else 6.
 */
export function snapVideoSeconds(durationSeconds: number): GrokVideoSeconds {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 6
  return durationSeconds >= 8 ? 10 : 6
}

/** Snap a clip's end so duration is exactly 6 or 10 seconds. */
export function snapClipRange(
  startTime: number,
  endTime: number
): { startTime: number; endTime: number; seconds: GrokVideoSeconds } {
  const start = Math.max(0, startTime)
  const seconds = snapVideoSeconds(endTime - start)
  return { startTime: start, endTime: start + seconds, seconds }
}
