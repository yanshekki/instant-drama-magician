import { describe, expect, it } from 'vitest'
import {
  defaultSpatialBlocking,
  isSpatialRefRole,
  parseSpatialBlocking,
  parseSpatialRefRole
} from './spatialRef'

describe('spatialRef', () => {
  it('parses roles and default blocking', () => {
    expect(isSpatialRefRole('spatial')).toBe(true)
    expect(isSpatialRefRole('mesh')).toBe(false)
    expect(parseSpatialRefRole('motion')).toBe('motion')
    expect(parseSpatialRefRole('nope')).toBe('identity')
    const blocking = defaultSpatialBlocking({
      characters: [{ id: 'c1', name: 'Nina' }],
      props: [{ id: 'p1', name: 'Bag' }],
      scenes: [{ id: 'sc1', name: 'Court' }]
    })
    expect(blocking.markers).toHaveLength(3)
    expect(blocking.markers[0]?.kind).toBe('character')
    expect(parseSpatialBlocking(blocking)?.version).toBe(1)
    expect(parseSpatialBlocking(null)).toBeNull()
  })
})
