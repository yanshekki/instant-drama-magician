import { describe, expect, it } from 'vitest'
import { defaultSpatialBlocking } from './spatialRef'
import {
  parseSpatialPackageManifest,
  spatialPlayblastRef,
  SPATIAL_PACKAGE_KIND
} from './spatialPackage'

describe('spatialPackage', () => {
  it('rejects unknown kinds and finds playblast refs', () => {
    expect(parseSpatialPackageManifest({ kind: 'nope' })).toBeNull()
    const blocking = defaultSpatialBlocking({
      characters: [{ id: 'c1', name: 'A' }]
    })
    const man = parseSpatialPackageManifest({
      kind: SPATIAL_PACKAGE_KIND,
      storyId: 's1',
      entryId: 'e1',
      blocking,
      playblastPath: '/tmp/white.png',
      refs: [{ role: 'identity', entityType: 'character', entityId: 'c1', path: '/c.png' }]
    })
    expect(man?.storyId).toBe('s1')
    expect(spatialPlayblastRef(man!)?.path).toBe('/tmp/white.png')
    const withMeshes = parseSpatialPackageManifest({
      kind: SPATIAL_PACKAGE_KIND,
      storyId: 's1',
      entryId: 'e1',
      blocking,
      refs: [{ role: 'spatial', entityType: 'spatial', entityId: 'e1', path: '/p.png' }],
      meshes: [
        { path: '', entityId: 'skip' },
        { path: '/m.gltf', entityId: 'p1', entityType: 'prop', sourceImagePath: '/t.png' }
      ]
    })
    expect(withMeshes?.meshes).toHaveLength(1)
    expect(spatialPlayblastRef(withMeshes!)?.path).toBe('/p.png')
    const empty = parseSpatialPackageManifest({
      kind: SPATIAL_PACKAGE_KIND,
      storyId: 's1',
      entryId: 'e1',
      blocking
    })
    expect(spatialPlayblastRef(empty!)).toBeNull()
  })
})
