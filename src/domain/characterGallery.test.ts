import { describe, expect, it } from 'vitest'
import {
  appendGalleryItem,
  parseCharacterGallery,
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
})
