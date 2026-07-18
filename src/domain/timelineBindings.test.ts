import { describe, expect, it } from 'vitest'
import {
  hydrateTimelineBindings,
  normalizeBindings,
  parseIdList,
  primaryId,
  serializeIdList
} from './timelineBindings'

describe('timelineBindings', () => {
  it('parses JSON and falls back to single id', () => {
    expect(parseIdList('["a","b"]')).toEqual(['a', 'b'])
    expect(parseIdList(null, 'x')).toEqual(['x'])
    expect(parseIdList('[]', 'x')).toEqual(['x'])
  })

  it('serializes and primaries', () => {
    expect(serializeIdList(['a', 'a', 'b'])).toBe(JSON.stringify(['a', 'b']))
    expect(primaryId(['a', 'b'])).toBe('a')
    expect(primaryId([])).toBeNull()
  })

  it('normalizes multi + legacy', () => {
    const n = normalizeBindings({
      characterIds: ['c1', 'c2'],
      sceneId: 's1',
      propIds: []
    })
    expect(n.characterId).toBe('c1')
    expect(n.characterIdList).toEqual(['c1', 'c2'])
    expect(n.sceneId).toBe('s1')
    expect(n.propId).toBeNull()
  })

  it('hydrates row', () => {
    const h = hydrateTimelineBindings({
      characterId: 'c1',
      sceneId: null,
      propId: 'p1',
      characterIds: null,
      sceneIds: JSON.stringify(['s1', 's2']),
      propIds: null
    })
    expect(h.characterIds).toEqual(['c1'])
    expect(h.sceneIds).toEqual(['s1', 's2'])
    expect(h.propIds).toEqual(['p1'])
  })
})
