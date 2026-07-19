import { describe, expect, it } from 'vitest'
import {
  listSceneExternalRefs,
  pickSceneExternalRefPath,
  type SceneGalleryItem
} from './sceneGallery'

const items: SceneGalleryItem[] = [
  {
    id: '1',
    path: '/a.png',
    kind: 'sheet',
    label: 'Sheet',
    createdAt: '2020-01-01'
  },
  {
    id: '2',
    path: '/ext.png',
    kind: 'external',
    label: 'Ext',
    createdAt: '2020-01-02'
  },
  {
    id: '3',
    path: '/up.png',
    kind: 'upload',
    label: 'Up',
    createdAt: '2020-01-03'
  }
]

describe('sceneGallery', () => {
  it('lists external and upload refs', () => {
    expect(listSceneExternalRefs(items)).toHaveLength(2)
  })

  it('picks preferred path when present', () => {
    expect(pickSceneExternalRefPath(items, '/up.png')).toBe('/up.png')
  })

  it('falls back to first external when preferred missing', () => {
    expect(pickSceneExternalRefPath(items, '/nope.png')).toBe('/ext.png')
  })

  it('returns null when empty', () => {
    expect(pickSceneExternalRefPath([], null)).toBeNull()
  })
})
