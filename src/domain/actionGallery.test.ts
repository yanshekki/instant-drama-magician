import { describe, expect, it } from 'vitest'
import {
  appendActionGalleryItem,
  galleryFromActionRow,
  parseActionGallery,
  primaryActionGalleryPath,
  serializeActionGallery
} from './actionGallery'

describe('actionGallery', () => {
  it('galleryFromActionRow uses ref paths', () => {
    const g = galleryFromActionRow({
      refImagePath: '/cover.png',
      refGalleryJson: null
    })
    expect(primaryActionGalleryPath(g)).toBeTruthy()
  })

  it('append and serialize round-trip', () => {
    let g = parseActionGallery(null, {})
    g = appendActionGalleryItem(g, {
      path: '/a.png',
      kind: 'plate',
      label: 'x'
    })
    const raw = serializeActionGallery(g)
    expect(parseActionGallery(raw, {}).some((i) => i.path === '/a.png')).toBe(
      true
    )
  })
})
