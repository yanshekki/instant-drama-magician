import { describe, expect, it } from 'vitest'
import {
  MAX_SCENE_IMAGE_EDIT_REFERENCES,
  appendSceneGalleryItem,
  filterSceneGalleryByLayer,
  inferSceneGalleryLayer,
  isSceneGalleryCoverPath,
  listSceneExternalRefs,
  moveSceneGalleryItem,
  parseSceneGallery,
  pickSceneExternalRefPath,
  pickSceneReferencePaths,
  primarySceneGalleryPath,
  removeSceneGalleryItem,
  serializeSceneGallery,
  setSceneGalleryIntroVideo,
  shiftSceneGalleryItem,
  type SceneGalleryItem
} from './sceneGallery'

const items: SceneGalleryItem[] = [
  {
    id: '1',
    path: '/a.png',
    kind: 'sheet',
    label: 'Sheet',
    createdAt: '2020-01-01',
    layer: 'hero'
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
    createdAt: '2020-01-03',
    layer: 'detail'
  }
]

describe('list / pick external refs', () => {
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

describe('parseSceneGallery / serialize', () => {
  it('returns empty for blank / invalid json', () => {
    expect(parseSceneGallery(null)).toEqual([])
    expect(parseSceneGallery('')).toEqual([])
    expect(parseSceneGallery('not-json')).toEqual([])
    expect(parseSceneGallery('{}')).toEqual([])
  })

  it('parses items, skips duplicates/invalid, normalizes kind/layer', () => {
    const json = JSON.stringify([
      {
        id: 'x',
        path: '/p.png',
        kind: 'sheet',
        label: 'Hero',
        layer: 'hero',
        introVideoPath: ' /v.mp4 ',
        createdAt: '2021-01-01'
      },
      { path: '/p.png', kind: 'gen' },
      null,
      { path: '', kind: 'gen' },
      { path: '/q.png', kind: 'weird', label: 1, layer: '  custom  ' },
      { path: '/r.png', layer: 99 }
    ])
    const parsed = parseSceneGallery(json)
    expect(parsed).toHaveLength(3)
    expect(parsed[0].introVideoPath).toBe('/v.mp4')
    expect(parsed[0].layer).toBe('hero')
    expect(parsed[1].kind).toBe('gen')
    expect(parsed[1].label).toBe('Image')
    expect(parsed[1].layer).toBe('custom')
    expect(parsed[2].layer).toBeUndefined()
  })

  it('appends legacy ref when not already present', () => {
    const withLegacy = parseSceneGallery(null, { refImagePath: '/legacy.png' })
    expect(withLegacy).toHaveLength(1)
    expect(withLegacy[0].id).toBe('legacy_scene_0')
    expect(withLegacy[0].kind).toBe('upload')

    const already = parseSceneGallery(
      JSON.stringify([{ path: '/legacy.png', kind: 'gen' }]),
      { refImagePath: '/legacy.png' }
    )
    expect(already).toHaveLength(1)
  })

  it('round-trips serialize', () => {
    const json = serializeSceneGallery(items)
    expect(parseSceneGallery(json)).toHaveLength(3)
  })
})

describe('gallery mutations', () => {
  it('sets intro video on matching path', () => {
    const next = setSceneGalleryIntroVideo(items, '/a.png', '/intro.mp4')
    expect(next.find((i) => i.path === '/a.png')?.introVideoPath).toBe(
      '/intro.mp4'
    )
    expect(setSceneGalleryIntroVideo(items, '', '/v.mp4')).toBe(items)
    expect(setSceneGalleryIntroVideo(items, '/a.png', '  ')).toBe(items)
  })

  it('primarySceneGalleryPath prefers cover then sheet', () => {
    expect(primarySceneGalleryPath([])).toBeNull()
    expect(primarySceneGalleryPath(items, '/up.png')).toBe('/up.png')
    expect(primarySceneGalleryPath(items, '/missing.png')).toBe('/a.png')
    expect(
      primarySceneGalleryPath(
        items.filter((i) => i.kind !== 'sheet'),
        null
      )
    ).toBe('/ext.png')
  })

  it('pickSceneReferencePaths orders preferred + sheet first', () => {
    expect(pickSceneReferencePaths([], 1)).toEqual([])
    expect(pickSceneReferencePaths(items, 0)).toEqual([])
    expect(pickSceneReferencePaths(items, 1, '/up.png')).toEqual(['/up.png'])
    expect(pickSceneReferencePaths(items, 2)).toEqual(['/a.png', '/ext.png'])
    expect(MAX_SCENE_IMAGE_EDIT_REFERENCES).toBe(1)
  })

  it('append / remove / move / shift', () => {
    let next = appendSceneGalleryItem(items, {
      path: '/new.png',
      kind: 'gen',
      label: 'New',
      layer: 'atmosphere'
    })
    expect(next[0].path).toBe('/new.png')
    expect(next[0].layer).toBe('atmosphere')
    // replace same path
    next = appendSceneGalleryItem(next, {
      id: 'fixed',
      path: '/new.png',
      kind: 'upload',
      label: 'Replaced',
      createdAt: '1999-01-01'
    })
    expect(next.filter((i) => i.path === '/new.png')).toHaveLength(1)
    expect(next[0].id).toBe('fixed')

    next = removeSceneGalleryItem(next, 'fixed')
    expect(next.find((i) => i.id === 'fixed')).toBeUndefined()

    expect(moveSceneGalleryItem(items, '3', '1').map((i) => i.id)).toEqual([
      '3',
      '1',
      '2'
    ])
    expect(shiftSceneGalleryItem(items, '2', 1).map((i) => i.id)).toEqual([
      '1',
      '3',
      '2'
    ])
  })

  it('cover / filter / infer layer', () => {
    expect(isSceneGalleryCoverPath(items, '/a.png')).toBe(true)
    expect(isSceneGalleryCoverPath(items, null)).toBe(false)
    expect(filterSceneGalleryByLayer(items, 'all')).toHaveLength(3)
    expect(filterSceneGalleryByLayer(items, 'detail')).toHaveLength(1)

    expect(inferSceneGalleryLayer({ label: 'x', layer: 'hero' })).toBe('hero')
    expect(inferSceneGalleryLayer({ label: 'Establishing wide' })).toBe(
      'establishing'
    )
    expect(inferSceneGalleryLayer({ label: 'Hero plate' })).toBe('hero')
    expect(inferSceneGalleryLayer({ label: 'Identity lock' })).toBe('identity')
    expect(inferSceneGalleryLayer({ label: 'Neon night rain' })).toBe(
      'atmosphere'
    )
    expect(inferSceneGalleryLayer({ label: 'Signage detail' })).toBe('detail')
    expect(inferSceneGalleryLayer({ label: 'Interior OTS' })).toBe('interior')
    expect(inferSceneGalleryLayer({ label: 'misc' })).toBeNull()
  })
})
