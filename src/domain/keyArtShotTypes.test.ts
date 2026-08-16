import { describe, expect, it } from 'vitest'
import {
  KEY_ART_SHOT_TYPES,
  coerceKeyArtShotType,
  getKeyArtShotType,
  keyArtTypeFormatLockKey
} from './keyArtShotTypes'

describe('keyArtShotTypes', () => {
  it('coerces unknown to cover and lists eight types', () => {
    expect(KEY_ART_SHOT_TYPES).toHaveLength(8)
    expect(coerceKeyArtShotType('nope')).toBe('cover')
    expect(coerceKeyArtShotType('headshot')).toBe('headshot')
    expect(getKeyArtShotType('poster').sizeClass).toBe('tall')
    expect(getKeyArtShotType('headshot').sizeClass).toBe('square')
    expect(getKeyArtShotType(null).id).toBe('cover')
    expect(keyArtTypeFormatLockKey('wide')).toBe('keyArt.formatLockWide')
    expect(keyArtTypeFormatLockKey('tall')).toBe('keyArt.formatLockTall')
    expect(keyArtTypeFormatLockKey('square')).toBe('keyArt.formatLockSquare')
  })
})
