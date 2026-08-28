import { describe, expect, it } from 'vitest'
import type { TimelineEntry } from '../types/domain'
import {
  buildTimelineLanes,
  clampWorkArea,
  entriesIntersectingRange,
  numberMediaPool,
  pictureKey,
  shotDialogueBadge,
  timelineLaneOffsetY,
  timelineLaneStackHeight,
  workAreaCoversAll
} from './timelineLanes'

function entry(partial: Partial<TimelineEntry> & { id: string }): TimelineEntry {
  return {
    storyId: 's1',
    startTime: 0,
    endTime: 6,
    characterId: null,
    sceneId: null,
    propId: null,
    actionId: null,
    characterIds: [],
    sceneIds: [],
    propIds: [],
    actionIds: [],
    dialogue: null,
    beatContentJson: null,
    order: 0,
    mediaPath: null,
    mediaStatus: 'EMPTY',
    mediaError: null,
    videoJobId: null,
    ...partial
  }
}

describe('timelineLanes', () => {
  it('numbers the media pool stably', () => {
    const nums = numberMediaPool([
      { key: pictureKey('character', 'c1') },
      { key: pictureKey('character', 'c1') },
      { key: pictureKey('scene', 's1') }
    ])
    expect(nums[pictureKey('character', 'c1')]).toBe(1)
    expect(nums[pictureKey('scene', 's1')]).toBe(2)
  })

  it('derives shot, ref, asset and keyframe clips', () => {
    const lanes = buildTimelineLanes({
      entries: [
        entry({
          id: 'e1',
          characterId: 'c1',
          characterIds: ['c1'],
          sceneId: 'sc1',
          sceneIds: ['sc1'],
          propId: 'p1',
          propIds: ['p1'],
          actionId: 'a1',
          actionIds: ['a1'],
          dialogue: '我愛你一生一世',
          mediaStatus: 'READY',
          startTime: 0,
          endTime: 6
        })
      ],
      labels: { e1: 'Nina' },
      characters: [{ id: 'c1', name: 'Nina', refImagePath: '/n.png' }],
      scenes: [{ id: 'sc1', title: 'Court' }],
      props: [{ id: 'p1', name: 'Bag' }],
      actions: [{ id: 'a1', name: 'Serve' }],
      stillByEntryId: { e1: '/still.png' },
      pictureByKey: {
        [pictureKey('character', 'c1')]: 1,
        [pictureKey('scene', 'sc1')]: 2
      }
    })
    const byId = Object.fromEntries(lanes.map((l) => [l.id, l]))
    expect(byId.shot.clips).toHaveLength(1)
    expect(byId.shot.clips[0].label).toBe('Nina')
    expect(byId.shot.clips[0].badge).toContain('我愛你')
    expect(byId.shot.clips[0].fill).toBe('ready')
    expect(byId.character.clips[0].pictureNo).toBe(1)
    expect(byId.scene.clips[0].label).toBe('Court')
    expect(byId.asset.clips).toHaveLength(2)
    expect(byId.keyframe.clips[0].imagePath).toBe('/still.png')
  })

  it('reads spoken lines from beat JSON for the shot badge', () => {
    const e = entry({
      id: 'e2',
      dialogue: null,
      beatContentJson: JSON.stringify({
        version: 1,
        units: [{ type: 'dialogue', who: 'A', line: 'hello there' }]
      })
    })
    expect(shotDialogueBadge(e)).toContain('hello there')
  })

  it('filters clips intersecting the work area', () => {
    const list = [
      entry({ id: 'a', startTime: 0, endTime: 3 }),
      entry({ id: 'b', startTime: 7, endTime: 9 }),
      entry({ id: 'c', startTime: 10, endTime: 12 })
    ]
    expect(entriesIntersectingRange(list, 0, 12).map((e) => e.id)).toEqual([
      'a',
      'b',
      'c'
    ])
    expect(entriesIntersectingRange(list, 6, 10).map((e) => e.id)).toEqual(['b'])
    expect(entriesIntersectingRange(list, 3, 7)).toEqual([])
    expect(entriesIntersectingRange(list, 5, 5)).toEqual([])
  })

  it('clamps work area and detects full coverage', () => {
    expect(clampWorkArea(-1, 99, 12)).toEqual({ start: 0, end: 12 })
    expect(clampWorkArea(8, 2, 10)).toEqual({ start: 2, end: 8 })
    expect(workAreaCoversAll(0, 12, 12)).toBe(true)
    expect(workAreaCoversAll(0, 6, 12)).toBe(false)
  })

  it('stacks lane offsets', () => {
    expect(timelineLaneOffsetY('shot')).toBe(0)
    expect(timelineLaneOffsetY('character')).toBeGreaterThan(0)
    expect(timelineLaneStackHeight()).toBeGreaterThan(timelineLaneOffsetY('keyframe'))
    expect(timelineLaneOffsetY('nope' as never)).toBe(timelineLaneStackHeight() + 4)
  })

  it('paints shot fills from bind lists and status', () => {
    const fills = buildTimelineLanes({
      entries: [
        entry({
          id: 'ids-only',
          characterId: null,
          characterIds: ['c9'],
          mediaStatus: 'EMPTY'
        }),
        entry({ id: 'fail', mediaStatus: 'FAILED', startTime: 6, endTime: 8 }),
        entry({
          id: 'queue',
          mediaStatus: 'QUEUED',
          startTime: 8,
          endTime: 10
        }),
        entry({
          id: 'scene-only',
          sceneId: null,
          sceneIds: ['sc9'],
          mediaStatus: 'EMPTY',
          startTime: 10,
          endTime: 12
        }),
        entry({
          id: 'prop-only',
          propId: null,
          propIds: ['p9'],
          mediaStatus: 'EMPTY',
          startTime: 12,
          endTime: 14
        }),
        entry({
          id: 'act-only',
          actionId: null,
          actionIds: ['a9'],
          mediaStatus: 'EMPTY',
          startTime: 14,
          endTime: 16
        }),
        entry({ id: 'blank', mediaStatus: 'EMPTY', startTime: 16, endTime: 18 })
      ]
    })
    const shot = Object.fromEntries(
      fills.find((l) => l.id === 'shot')!.clips.map((c) => [c.entryId, c.fill])
    )
    expect(shot['ids-only']).toBe('character')
    expect(shot.fail).toBe('failed')
    expect(shot.queue).toBe('generating')
    expect(shot['scene-only']).toBe('scene')
    expect(shot['prop-only']).toBe('prop')
    expect(shot['act-only']).toBe('action')
    expect(shot.blank).toBe('empty')
  })

  it('expands a tiny work area and ignores empty pool keys', () => {
    expect(clampWorkArea(5, 5.02, 12)).toEqual({ start: 5, end: 5.1 })
    expect(clampWorkArea(Number.NaN, Number.NaN, 8)).toEqual({ start: 0, end: 8 })
    expect(numberMediaPool([{ key: '  ' }, { key: 'scene:s1' }])).toEqual({
      'scene:s1': 1
    })
  })
})
