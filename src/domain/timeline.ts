import type { TimelineEntry } from '../types/domain'

/** Default max clip length (seconds) for AI video generation limits. */
export const DEFAULT_MAX_CLIP_SECONDS = 10

export interface TimeSlot {
  startTime: number
  endTime: number
  order: number
}

export interface TimeRange {
  startTime: number
  endTime: number
}

/** Total duration in seconds from the latest endTime. */
export function totalDuration(entries: readonly TimelineEntry[]): number {
  if (entries.length === 0) return 0
  return entries.reduce((max, e) => Math.max(max, e.endTime), 0)
}

/** Sort by order, then startTime. */
export function sortTimelineEntries(entries: readonly TimelineEntry[]): TimelineEntry[] {
  return [...entries].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order
    return a.startTime - b.startTime
  })
}

/** Suggest next free slot of given duration after the last clip. */
export function suggestNextSlot(
  entries: readonly TimelineEntry[],
  durationSeconds: number
): TimeSlot {
  const sorted = sortTimelineEntries(entries)
  const startTime = sorted.length > 0 ? totalDuration(sorted) : 0
  const order = sorted.length > 0 ? sorted[sorted.length - 1].order + 1 : 0
  return {
    startTime,
    endTime: startTime + Math.max(0, durationSeconds),
    order
  }
}

/** Clamp entry duration to a max clip length (e.g. AI video limit). */
export function clampDuration(
  startTime: number,
  endTime: number,
  maxClipSeconds: number = DEFAULT_MAX_CLIP_SECONDS
): TimeRange {
  const safeStart = Math.max(0, startTime)
  const duration = Math.max(0, endTime - safeStart)
  const clamped = Math.min(duration, maxClipSeconds)
  return { startTime: safeStart, endTime: safeStart + clamped }
}

/** Move a clip in time while preserving duration and clamping to max length. */
export function moveClip(
  startTime: number,
  endTime: number,
  deltaSeconds: number,
  maxClipSeconds: number = DEFAULT_MAX_CLIP_SECONDS
): TimeRange {
  const duration = Math.max(0, endTime - startTime)
  const nextStart = Math.max(0, startTime + deltaSeconds)
  return clampDuration(nextStart, nextStart + duration, maxClipSeconds)
}

/** Resize clip end time, ensuring duration stays within (0, maxClip]. */
export function resizeClipEnd(
  startTime: number,
  endTime: number,
  maxClipSeconds: number = DEFAULT_MAX_CLIP_SECONDS
): TimeRange {
  return clampDuration(startTime, endTime, maxClipSeconds)
}

/** Validate a timeline entry time range. */
export function validateTimeRange(
  startTime: number,
  endTime: number,
  maxClipSeconds: number = DEFAULT_MAX_CLIP_SECONDS
): string | null {
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    return 'errors.timelineTimesInvalid'
  }
  if (startTime < 0) return 'errors.startTimeNegative'
  if (endTime <= startTime) return 'errors.endTimeOrder'
  if (endTime - startTime > maxClipSeconds) {
    return 'errors.clipDurationTooLong'
  }
  return null
}

/** Recompute sequential order indices after a reorder of ids. */
export function reindexOrders(orderedIds: readonly string[]): Map<string, number> {
  const map = new Map<string, number>()
  orderedIds.forEach((id, index) => {
    map.set(id, index)
  })
  return map
}

export interface PackedTimelineSlot {
  id: string
  startTime: number
  endTime: number
  order: number
}

/**
 * Pack clips end-to-end with no gaps, preserving each clip's duration.
 * Sort: order, then startTime. First clip starts at 0.
 */
export function packTimelineEntriesAbutting(
  entries: readonly TimelineEntry[]
): PackedTimelineSlot[] {
  const sorted = sortTimelineEntries(entries)
  let t = 0
  return sorted.map((e, i) => {
    const dur = Math.max(0, e.endTime - e.startTime)
    const startTime = t
    const endTime = t + dur
    t = endTime
    return { id: e.id, startTime, endTime, order: i }
  })
}

/** True if already packed (order + times match abutting plan within epsilon). */
export function isTimelineAlreadyPacked(
  entries: readonly TimelineEntry[],
  epsilon = 1e-6
): boolean {
  const plan = packTimelineEntriesAbutting(entries)
  if (plan.length !== entries.length) return false
  const byId = new Map(entries.map((e) => [e.id, e]))
  for (const p of plan) {
    const e = byId.get(p.id)
    if (!e) return false
    if (e.order !== p.order) return false
    if (Math.abs(e.startTime - p.startTime) > epsilon) return false
    if (Math.abs(e.endTime - p.endTime) > epsilon) return false
  }
  return true
}
