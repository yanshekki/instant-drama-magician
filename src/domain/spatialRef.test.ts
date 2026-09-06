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
    const parsed = parseSpatialBlocking({
      version: 1,
      aspect: '9:16',
      camera: { x: 0.2, y: 0.1, z: 0.1, fov: 40, lookAtX: 0.5, lookAtY: 0.1, lookAtZ: 0.4 },
      markers: [
        { kind: 'nope', entityId: 'x', x: 0.1, z: 0.1 },
        { kind: 'prop', entityId: '', x: 0.2, z: 0.2 },
        { kind: 'costume', entityId: 'k1', name: 'Coat', x: 0.3, z: 0.4 }
      ]
    })
    expect(parsed?.aspect).toBe('9:16')
    expect(parsed?.markers).toHaveLength(1)
    expect(parsed?.markers[0]?.kind).toBe('costume')
  })
})
