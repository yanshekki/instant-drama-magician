import { describe, expect, it } from 'vitest'
import {
  newKeyArtShotImageId,
  parseKeyArtShotImages,
  pickKeyArtShotPrimary,
  prependKeyArtShotImage,
  serializeKeyArtShotImages
} from './keyArtShotImages'

describe('keyArtShotImages', () => {
  it('parses, prepends, and picks primary', () => {
    expect(newKeyArtShotImageId().startsWith('ka_')).toBe(true)
    const a = {
      id: 'a',
      path: '/a.png',
      method: 'fresh' as const,
      createdAt: '2026-01-01T00:00:00.000Z'
    }
    const b = {
      id: 'b',
      path: '/b.png',
      method: 'edit' as const,
      createdAt: '2026-01-02T00:00:00.000Z'
    }
    const next = prependKeyArtShotImage([a], b)
    expect(next[0]!.id).toBe('b')
    expect(pickKeyArtShotPrimary(next, '/a.png')).toBe('/a.png')
    expect(pickKeyArtShotPrimary(next, '/gone.png')).toBe('/b.png')
    const json = serializeKeyArtShotImages(next)
    expect(parseKeyArtShotImages(json)).toHaveLength(2)
    expect(
      parseKeyArtShotImages(null, { imagePath: '/legacy.png' })[0]!.id
    ).toBe('legacy_primary')
  })
})
