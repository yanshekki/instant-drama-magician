import type { TimelineEntry } from '../types/domain'

/** Pure helpers for linear timeline control (AI video length limits). */
export class TimelineService {
  /** Total duration in seconds from the latest endTime. */
  static totalDuration(entries: TimelineEntry[]): number {
    if (entries.length === 0) return 0
    return entries.reduce((max, e) => Math.max(max, e.endTime), 0)
  }

  /** Sort by order, then startTime. */
  static sort(entries: TimelineEntry[]): TimelineEntry[] {
    return [...entries].sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order
      return a.startTime - b.startTime
    })
  }

  /** Suggest next free slot of given duration after the last clip. */
  static suggestNextSlot(
    entries: TimelineEntry[],
    durationSeconds: number
  ): { startTime: number; endTime: number; order: number } {
    const sorted = this.sort(entries)
    const startTime = sorted.length > 0 ? this.totalDuration(sorted) : 0
    const order = sorted.length > 0 ? sorted[sorted.length - 1].order + 1 : 0
    return {
      startTime,
      endTime: startTime + durationSeconds,
      order
    }
  }

  /** Clamp entry duration to a max clip length (e.g. AI video limit). */
  static clampDuration(
    startTime: number,
    endTime: number,
    maxClipSeconds: number
  ): { startTime: number; endTime: number } {
    const duration = Math.max(0, endTime - startTime)
    const clamped = Math.min(duration, maxClipSeconds)
    return { startTime, endTime: startTime + clamped }
  }

  static readonly DEFAULT_MAX_CLIP_SECONDS = 10
}
