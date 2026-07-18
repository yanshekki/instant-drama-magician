import { describe, expect, it } from 'vitest'
import {
  ART_STYLES,
  DEFAULT_ART_STYLE,
  getArtStyle,
  qualityBlockForFamily,
  artStylesByGroup
} from './characterArtStyles'
import { buildCharacterSheetImagePrompt } from './characterMasterPrompt'

describe('characterArtStyles', () => {
  it('has professional style catalogue', () => {
    expect(ART_STYLES.length).toBeGreaterThanOrEqual(12)
    expect(getArtStyle(undefined).id).toBe(DEFAULT_ART_STYLE)
    const g = artStylesByGroup()
    expect(g.artGroupPhoto.length).toBeGreaterThan(0)
    expect(g.artGroupAnime.length).toBeGreaterThan(3)
  })

  it('anime quality block avoids photoreal pores', () => {
    const q = qualityBlockForFamily('anime')
    expect(q).toMatch(/2D|cel|anime/i)
    expect(q).not.toMatch(/skin pores/)
  })

  it('front-loads mandatory medium and repeats style id', () => {
    const photo = buildCharacterSheetImagePrompt(
      { name: 'Miko', appearance: 'fox spirit' },
      'face_id',
      'photo_cinematic'
    )
    expect(photo.indexOf('MANDATORY MEDIUM')).toBeLessThan(
      photo.indexOf('IDENTITY LOCK')
    )
    expect(photo).toMatch(/photo_cinematic/)
    expect(photo).toMatch(/LIVE-ACTION PHOTOREAL|PHOTOREAL/i)

    const anime = buildCharacterSheetImagePrompt(
      { name: 'Miko', appearance: 'fox spirit' },
      'face_id',
      'anime_modern'
    )
    expect(anime.startsWith('MANDATORY MEDIUM')).toBe(true)
    expect(anime).toMatch(/anime_modern/)
    expect(anime).toMatch(/2D MODERN JAPANESE TV ANIME/i)
    expect(anime).toMatch(/FORBIDDEN:[\s\S]*photoreal/i)
  })
})
