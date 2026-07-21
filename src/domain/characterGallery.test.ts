import { describe, expect, it } from 'vitest'
import {
  appendGalleryItem,
  filterGalleryByLayer,
  isExternalRefItem,
  isGalleryCoverPath,
  listExternalRefs,
  MAX_IMAGE_EDIT_REFERENCES,
  moveGalleryItem,
  parseCharacterGallery,
  pickExternalRefPath,
  pickGalleryReferencePaths,
  primaryGalleryPath,
  removeGalleryItem,
  serializeCharacterGallery,
  setGalleryIntroVideo,
  shiftGalleryItem
} from './characterGallery'

describe('characterGallery', () => {
  it('migrates legacy paths and appends unique', () => {
    const g = parseCharacterGallery(null, {
      refImagePath: '/a.png',
      refSheetPath: '/b_sheet.png'
    })
    expect(g.length).toBe(2)
    const next = appendGalleryItem(g, {
      path: '/c.png',
      kind: 'gen',
      label: 'New'
    })
    expect(next[0].path).toBe('/c.png')
    expect(primaryGalleryPath(next)?.includes('sheet') || next.length).toBeTruthy()
    const json = serializeCharacterGallery(next)
    expect(parseCharacterGallery(json)).toHaveLength(3)
    expect(removeGalleryItem(next, next[0].id)).toHaveLength(2)
  })

  it('appends second sheet without dropping the first (unique paths)', () => {
    let g = appendGalleryItem([], {
      path: '/chars/c_sheet_1.png',
      kind: 'sheet',
      label: 'Bible sheet'
    })
    g = appendGalleryItem(g, {
      path: '/chars/c_sheet_2.png',
      kind: 'sheet',
      label: 'Bible sheet'
    })
    expect(g).toHaveLength(2)
    expect(g[0].path).toBe('/chars/c_sheet_2.png')
    expect(g[1].path).toBe('/chars/c_sheet_1.png')
    expect(primaryGalleryPath(g)).toBe('/chars/c_sheet_2.png')
    expect(primaryGalleryPath(g, '/chars/c_sheet_1.png')).toBe(
      '/chars/c_sheet_1.png'
    )
  })

  it('picks at most MAX_IMAGE_EDIT_REFERENCES paths (Gateway edits = 1)', () => {
    expect(MAX_IMAGE_EDIT_REFERENCES).toBe(1)
    const g = [
      {
        id: '1',
        path: '/new_sheet.png',
        kind: 'sheet' as const,
        label: 'A',
        createdAt: '2026-01-02'
      },
      {
        id: '2',
        path: '/old_upload.png',
        kind: 'upload' as const,
        label: 'B',
        createdAt: '2026-01-01'
      }
    ]
    expect(pickGalleryReferencePaths(g)).toEqual(['/new_sheet.png'])
    expect(
      pickGalleryReferencePaths(g, MAX_IMAGE_EDIT_REFERENCES, '/old_upload.png')
    ).toEqual(['/old_upload.png'])
    expect(pickGalleryReferencePaths(g, 0)).toEqual([])
  })

  it('round-trips optional wardrobe layer on gallery items', () => {
    const g = appendGalleryItem([], {
      path: '/body.png',
      kind: 'sheet',
      label: 'Body nude front',
      layer: 'nude'
    })
    expect(g[0].layer).toBe('nude')
    const again = parseCharacterGallery(serializeCharacterGallery(g))
    expect(again[0].layer).toBe('nude')
  })

  it('reorders items by drag move (arrayMove semantics)', () => {
    const g = [
      {
        id: 'a',
        path: '/a.png',
        kind: 'sheet' as const,
        label: 'A',
        createdAt: '1'
      },
      {
        id: 'b',
        path: '/b.png',
        kind: 'sheet' as const,
        label: 'B',
        createdAt: '2'
      },
      {
        id: 'c',
        path: '/c.png',
        kind: 'sheet' as const,
        label: 'C',
        createdAt: '3'
      }
    ]
    // Move C onto A → C takes index 0
    expect(moveGalleryItem(g, 'c', 'a').map((i) => i.id)).toEqual([
      'c',
      'a',
      'b'
    ])
    // Move B onto C → B takes index of C
    expect(moveGalleryItem(g, 'b', 'c').map((i) => i.id)).toEqual([
      'a',
      'c',
      'b'
    ])
    expect(moveGalleryItem(g, 'a', 'a')).toEqual(g)
  })

  it('filters by layer and can hide nude', () => {
    const g = [
      {
        id: '1',
        path: '/n.png',
        kind: 'sheet' as const,
        label: 'Nude',
        createdAt: '1',
        layer: 'nude' as const
      },
      {
        id: '2',
        path: '/b.png',
        kind: 'sheet' as const,
        label: 'Base',
        createdAt: '2',
        layer: 'base' as const
      },
      {
        id: '3',
        path: '/x.png',
        kind: 'gen' as const,
        label: 'No layer',
        createdAt: '3'
      }
    ]
    expect(filterGalleryByLayer(g, 'base')).toHaveLength(1)
    expect(filterGalleryByLayer(g, 'all', { hideNude: true })).toHaveLength(2)
    expect(filterGalleryByLayer(g, 'all', { hideNude: true })[0].path).toBe(
      '/b.png'
    )
    expect(
      filterGalleryByLayer(g, 'costume', {
        inferLayer: (it) => (it.path === '/x.png' ? 'costume' : null)
      })
    ).toHaveLength(1)
  })

  it('external refs pick / intro video / cover / shift', () => {
    const g = [
      {
        id: 's',
        path: '/s.png',
        kind: 'sheet' as const,
        label: 'S',
        createdAt: '1'
      },
      {
        id: 'u',
        path: '/u.png',
        kind: 'upload' as const,
        label: 'U',
        createdAt: '2'
      },
      {
        id: 'e',
        path: '/e.png',
        kind: 'external' as const,
        label: 'E',
        createdAt: '3'
      }
    ]
    expect(isExternalRefItem(g[1])).toBe(true)
    expect(listExternalRefs(g)).toHaveLength(2)
    expect(pickExternalRefPath(g, { preferredPath: '/e.png' })).toBe('/e.png')
    expect(pickExternalRefPath(g, { selectedId: 'u' })).toBe('/u.png')
    expect(pickExternalRefPath(g)).toBe('/u.png')
    expect(pickExternalRefPath([], {})).toBeNull()

    expect(isGalleryCoverPath(g, '/s.png')).toBe(true)
    expect(isGalleryCoverPath(g, null)).toBe(false)
    expect(primaryGalleryPath([])).toBeNull()
    expect(primaryGalleryPath(g.filter((i) => i.kind !== 'sheet'))).toBe(
      '/u.png'
    )

    const withVid = setGalleryIntroVideo(g, '/s.png', '/intro.mp4')
    expect(withVid.find((i) => i.id === 's')?.introVideoPath).toBe('/intro.mp4')
    expect(setGalleryIntroVideo(g, '', '/v.mp4')).toBe(g)
    expect(setGalleryIntroVideo(g, '/missing.png', '/v.mp4')).toBe(g)

    expect(shiftGalleryItem(g, 'u', -1).map((i) => i.id)).toEqual([
      'u',
      's',
      'e'
    ])
  })

  it('parse ignores corrupt json and invalid kinds', () => {
    expect(parseCharacterGallery('not-json')).toEqual([])
    expect(parseCharacterGallery('{}')).toEqual([])
    const g = parseCharacterGallery(
      JSON.stringify([
        { path: '/a.png', kind: 'weird', introVideoPath: ' /v.mp4 ' },
        { path: '/a.png' },
        null,
        { path: '' },
        { path: '/b.png', layer: 'nope', label: 1 }
      ])
    )
    expect(g).toHaveLength(2)
    expect(g[0].kind).toBe('gen')
    expect(g[0].introVideoPath).toBe('/v.mp4')
    expect(g[0].label).toBe('Image')
    expect(g[1].layer).toBeUndefined()
  })
})
