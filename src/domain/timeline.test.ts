import { describe, expect, it } from 'vitest'
import {
  clampDuration,
  DEFAULT_MAX_CLIP_SECONDS,
  reindexOrders,
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
    dialogue: null,
    mediaPath: null,
    mediaStatus: 'EMPTY',
    mediaError: null,
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
    expect(validateTimeRange(5, 2)).toMatch(/greater/)
    expect(validateTimeRange(0, 20)).toMatch(/<=/)
  })

  it('reindexes orders', () => {
    const map = reindexOrders(['x', 'y', 'z'])
    expect(map.get('y')).toBe(1)
  })
})
