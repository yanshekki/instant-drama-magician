import { describe, expect, it } from 'vitest'
import {
  appendGalleryItem,
  filterGalleryByLayer,
  MAX_IMAGE_EDIT_REFERENCES,
  moveGalleryItem,
  parseCharacterGallery,
  pickGalleryReferencePaths,
  primaryGalleryPath,
  removeGalleryItem,
  serializeCharacterGallery
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
      }
    ]
    expect(filterGalleryByLayer(g, 'base')).toHaveLength(1)
    expect(filterGalleryByLayer(g, 'all', { hideNude: true })).toHaveLength(1)
    expect(filterGalleryByLayer(g, 'all', { hideNude: true })[0].path).toBe(
      '/b.png'
    )
  })
})
