import { describe, expect, it } from 'vitest'
import { TimelineService } from './TimelineService'
import type { TimelineEntry } from '../types/domain'

function entry(
  partial: Partial<TimelineEntry> & Pick<TimelineEntry, 'id' | 'order' | 'startTime' | 'endTime'>
): TimelineEntry {
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

describe('TimelineService facade', () => {
  it('delegates pure domain helpers', () => {
    expect(TimelineService.DEFAULT_MAX_CLIP_SECONDS).toBe(10)
    const entries = [
      entry({ id: 'b', order: 1, startTime: 5, endTime: 11 }),
      entry({ id: 'a', order: 0, startTime: 0, endTime: 5 })
    ]
    expect(TimelineService.totalDuration(entries)).toBe(11)
    expect(TimelineService.sort(entries).map((e) => e.id)).toEqual(['a', 'b'])
    expect(TimelineService.suggestNextSlot(entries, 4)).toEqual({
      startTime: 11,
      endTime: 15,
      order: 2
    })
    expect(TimelineService.clampDuration(0, 30)).toEqual({
      startTime: 0,
      endTime: 10
    })
    expect(TimelineService.moveClip(0, 5, 2)).toEqual({
      startTime: 2,
      endTime: 7
    })
    expect(TimelineService.resizeClipEnd(0, 20)).toEqual({
      startTime: 0,
      endTime: 10
    })
    expect(TimelineService.validateTimeRange(0, 5)).toBeNull()
    expect(TimelineService.validateTimeRange(5, 1)).toBe('errors.endTimeOrder')
    expect(TimelineService.reindexOrders(['x', 'y']).get('y')).toBe(1)
  })

  it('packs and detects packed state', () => {
    const gappy = [
      entry({ id: 'a', order: 0, startTime: 0, endTime: 6 }),
      entry({ id: 'b', order: 1, startTime: 10, endTime: 16 })
    ]
    const packed = TimelineService.packAbutting(gappy)
    expect(packed).toEqual([
      { id: 'a', startTime: 0, endTime: 6, order: 0 },
      { id: 'b', startTime: 6, endTime: 12, order: 1 }
    ])
    expect(TimelineService.isAlreadyPacked(gappy)).toBe(false)
    const asEntries = packed.map((p) => entry({ ...p, storyId: 's1' }))
    expect(TimelineService.isAlreadyPacked(asEntries)).toBe(true)
  })
})
