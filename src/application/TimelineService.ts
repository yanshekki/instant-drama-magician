import type { TimelineEntry } from '../types/domain'
import {
  DEFAULT_MAX_CLIP_SECONDS,
  clampDuration,
  isTimelineAlreadyPacked,
  moveClip,
  packTimelineEntriesAbutting,
  reindexOrders,
  resizeClipEnd,
  sortTimelineEntries,
  suggestNextSlot,
  totalDuration,
  validateTimeRange,
  type PackedTimelineSlot,
  type TimeRange,
  type TimeSlot
} from '../domain/timeline'

/**
 * Application-facing timeline helpers.
 * Pure rules live in `src/domain/timeline`; this class is a stable facade
 * for presentation and future persistence services.
 */
export class TimelineService {
  static readonly DEFAULT_MAX_CLIP_SECONDS = DEFAULT_MAX_CLIP_SECONDS

  static totalDuration(entries: readonly TimelineEntry[]): number {
    return totalDuration(entries)
  }

  static sort(entries: readonly TimelineEntry[]): TimelineEntry[] {
    return sortTimelineEntries(entries)
  }

  static suggestNextSlot(
    entries: readonly TimelineEntry[],
    durationSeconds: number
  ): TimeSlot {
    return suggestNextSlot(entries, durationSeconds)
  }

  static clampDuration(
    startTime: number,
    endTime: number,
    maxClipSeconds: number = DEFAULT_MAX_CLIP_SECONDS
  ): TimeRange {
    return clampDuration(startTime, endTime, maxClipSeconds)
  }

  static moveClip(
    startTime: number,
    endTime: number,
    deltaSeconds: number,
    maxClipSeconds: number = DEFAULT_MAX_CLIP_SECONDS
  ): TimeRange {
    return moveClip(startTime, endTime, deltaSeconds, maxClipSeconds)
  }

  static resizeClipEnd(
    startTime: number,
    endTime: number,
    maxClipSeconds: number = DEFAULT_MAX_CLIP_SECONDS
  ): TimeRange {
    return resizeClipEnd(startTime, endTime, maxClipSeconds)
  }

  static validateTimeRange(
    startTime: number,
    endTime: number,
    maxClipSeconds: number = DEFAULT_MAX_CLIP_SECONDS
  ): string | null {
    return validateTimeRange(startTime, endTime, maxClipSeconds)
  }

  static reindexOrders(orderedIds: readonly string[]): Map<string, number> {
    return reindexOrders(orderedIds)
  }

  static packAbutting(
    entries: readonly TimelineEntry[]
  ): PackedTimelineSlot[] {
    return packTimelineEntriesAbutting(entries)
  }

  static isAlreadyPacked(entries: readonly TimelineEntry[]): boolean {
    return isTimelineAlreadyPacked(entries)
  }
}
