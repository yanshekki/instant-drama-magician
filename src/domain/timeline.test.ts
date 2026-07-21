import { describe, expect, it } from 'vitest'
import {
  clampDuration,
  DEFAULT_MAX_CLIP_SECONDS,
  isTimelineAlreadyPacked,
  moveClip,
  packTimelineEntriesAbutting,
  reindexOrders,
  resizeClipEnd,
  sortTimelineEntries,
  suggestNextSlot,
  totalDuration,
  validateTimeRange
} from './timeline'
import type { TimelineEntry } from '../types/domain'

function entry(partial: Partial<TimelineEntry> & Pick<TimelineEntry, 'id' | 'order' | 'startTime' | 'endTime'>): TimelineEntry {
  return {
    storyId: 's1',
    characterId: null,
    sceneId: null,
    propId: null,
    characterIds: [],
    sceneIds: [],
    propIds: [],
    dialogue: null,
    beatContentJson: null,
    mediaPath: null,
    mediaStatus: 'EMPTY',
    mediaError: null,
    videoJobId: null,
    ...partial
  }
}

describe('timeline domain', () => {
  it('computes total duration from max endTime', () => {
    const entries = [
      entry({ id: 'a', order: 0, startTime: 0, endTime: 4 }),
      entry({ id: 'b', order: 1, startTime: 3, endTime: 9 })
    ]
    expect(totalDuration(entries)).toBe(9)
  })

  it('sorts by order then startTime', () => {
    const entries = [
      entry({ id: 'b', order: 1, startTime: 5, endTime: 8 }),
      entry({ id: 'a', order: 0, startTime: 2, endTime: 4 }),
      entry({ id: 'c', order: 0, startTime: 0, endTime: 1 })
    ]
    expect(sortTimelineEntries(entries).map((e) => e.id)).toEqual(['c', 'a', 'b'])
  })

  it('suggests next slot after last clip', () => {
    const entries = [entry({ id: 'a', order: 0, startTime: 0, endTime: 5 })]
    expect(suggestNextSlot(entries, 3)).toEqual({
      startTime: 5,
      endTime: 8,
      order: 1
    })
  })

  it('clamps to AI max clip length', () => {
    expect(clampDuration(0, 30, DEFAULT_MAX_CLIP_SECONDS)).toEqual({
      startTime: 0,
      endTime: 10
    })
  })

  it('validates ranges', () => {
    expect(validateTimeRange(0, 5)).toBeNull()
    expect(validateTimeRange(5, 2)).toBe('errors.endTimeOrder')
    expect(validateTimeRange(0, 20)).toBe('errors.clipDurationTooLong')
  })

  it('reindexes orders', () => {
    const map = reindexOrders(['x', 'y', 'z'])
    expect(map.get('y')).toBe(1)
  })

  it('packs clips end-to-end preserving duration', () => {
    const entries = [
      entry({ id: 'a', order: 0, startTime: 0, endTime: 6 }),
      entry({ id: 'b', order: 1, startTime: 10, endTime: 16 }),
      entry({ id: 'c', order: 2, startTime: 20, endTime: 30 })
    ]
    expect(packTimelineEntriesAbutting(entries)).toEqual([
      { id: 'a', startTime: 0, endTime: 6, order: 0 },
      { id: 'b', startTime: 6, endTime: 12, order: 1 },
      { id: 'c', startTime: 12, endTime: 22, order: 2 }
    ])
    expect(isTimelineAlreadyPacked(entries)).toBe(false)
    const packed = packTimelineEntriesAbutting(entries).map((p) =>
      entry({ ...p, storyId: 's1' })
    )
    expect(isTimelineAlreadyPacked(packed)).toBe(true)
  })

  it('empty timeline helpers', () => {
    expect(totalDuration([])).toBe(0)
    expect(suggestNextSlot([], 4)).toEqual({
      startTime: 0,
      endTime: 4,
      order: 0
    })
    expect(suggestNextSlot([], -2).endTime).toBe(0)
    expect(packTimelineEntriesAbutting([])).toEqual([])
    expect(isTimelineAlreadyPacked([])).toBe(true)
  })

  it('moveClip and resizeClipEnd preserve duration bounds', () => {
    expect(moveClip(2, 8, 3)).toEqual({ startTime: 5, endTime: 11 })
    expect(moveClip(0, 5, -10)).toEqual({ startTime: 0, endTime: 5 })
    expect(moveClip(0, 20, 0, 10)).toEqual({ startTime: 0, endTime: 10 })
    expect(resizeClipEnd(0, 30, 10)).toEqual({ startTime: 0, endTime: 10 })
    expect(clampDuration(-2, 5, 10)).toEqual({ startTime: 0, endTime: 5 })
  })

  it('validateTimeRange covers finite / negative / order', () => {
    expect(validateTimeRange(NaN, 5)).toBe('errors.timelineTimesInvalid')
    expect(validateTimeRange(0, Infinity)).toBe('errors.timelineTimesInvalid')
    expect(validateTimeRange(-1, 5)).toBe('errors.startTimeNegative')
    expect(validateTimeRange(5, 5)).toBe('errors.endTimeOrder')
  })

  it('isTimelineAlreadyPacked fails on order/time mismatch', () => {
    const entries = [
      entry({ id: 'a', order: 1, startTime: 0, endTime: 5 }),
      entry({ id: 'b', order: 0, startTime: 5, endTime: 10 })
    ]
    expect(isTimelineAlreadyPacked(entries)).toBe(false)
  })
})
