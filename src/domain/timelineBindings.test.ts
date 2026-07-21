import { describe, expect, it } from 'vitest'
import {
  MAX_BEAT_ACTIONS,
  MAX_BEAT_CHARACTERS,
  MAX_BEAT_PROPS,
  MAX_BEAT_SCENES,
  clampIdList,
  hydrateTimelineBindings,
  normalizeBindings,
  parseIdList,
  primaryId,
  serializeIdList
} from './timelineBindings'

describe('timelineBindings', () => {
  it('parses JSON and falls back to single id', () => {
    expect(parseIdList('["a","b"]')).toEqual(['a', 'b'])
    expect(parseIdList('["a","a"," b "]')).toEqual(['a', 'b'])
    expect(parseIdList(null, 'x')).toEqual(['x'])
    expect(parseIdList('[]', 'x')).toEqual(['x'])
    expect(parseIdList('not-json', 'fb')).toEqual(['fb'])
    expect(parseIdList('{}', null)).toEqual([])
    expect(parseIdList(null, '  ')).toEqual([])
    expect(parseIdList('["", "  "]', 'z')).toEqual(['z'])
  })

  it('serializes and primaries', () => {
    expect(serializeIdList(['a', 'a', 'b'])).toBe(JSON.stringify(['a', 'b']))
    expect(serializeIdList([])).toBeNull()
    expect(serializeIdList(null)).toBeNull()
    expect(serializeIdList(['', '  '])).toBeNull()
    expect(primaryId(['a', 'b'])).toBe('a')
    expect(primaryId([])).toBeNull()
    expect(primaryId(null)).toBeNull()
  })

  it('clampIdList respects max constants', () => {
    expect(MAX_BEAT_CHARACTERS).toBe(4)
    expect(MAX_BEAT_SCENES).toBe(2)
    expect(MAX_BEAT_PROPS).toBe(4)
    expect(MAX_BEAT_ACTIONS).toBe(4)
    expect(clampIdList(['a', 'b', 'c'], 2)).toEqual(['a', 'b'])
    expect(clampIdList(['a'], 5)).toEqual(['a'])
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

  it('normalizes from existing row when fields omitted', () => {
    const n = normalizeBindings({
      existing: {
        characterId: 'c0',
        characterIds: JSON.stringify(['c0', 'c9']),
        sceneId: 's0',
        propId: 'p0',
        actionId: 'a0',
        actionIds: JSON.stringify(['a0', 'a1'])
      }
    })
    expect(n.characterIdList).toEqual(['c0', 'c9'])
    expect(n.sceneId).toBe('s0')
    expect(n.propId).toBe('p0')
    expect(n.actionIdList).toEqual(['a0', 'a1'])
  })

  it('explicit empty multi clears bindings', () => {
    const n = normalizeBindings({
      characterIds: [],
      sceneIds: [],
      propIds: [],
      actionIds: [],
      existing: {
        characterId: 'c1',
        sceneId: 's1',
        propId: 'p1',
        actionId: 'a1'
      }
    })
    expect(n.characterId).toBeNull()
    expect(n.sceneId).toBeNull()
    expect(n.propId).toBeNull()
    expect(n.actionId).toBeNull()
  })

  it('single id fields build lists', () => {
    const n = normalizeBindings({
      characterId: 'c1',
      sceneId: 's1',
      propId: 'p1',
      actionId: 'a1'
    })
    expect(n.characterIdList).toEqual(['c1'])
    expect(n.sceneIdList).toEqual(['s1'])
    expect(n.propIdList).toEqual(['p1'])
    expect(n.actionIdList).toEqual(['a1'])
  })

  it('clamps oversized character multi lists', () => {
    const n = normalizeBindings({
      characterIds: ['1', '2', '3', '4', '5', '6']
    })
    expect(n.characterIdList).toHaveLength(MAX_BEAT_CHARACTERS)
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
