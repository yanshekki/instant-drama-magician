import { describe, expect, it } from 'vitest'
import {
  ART_STYLES,
  DEFAULT_ART_STYLE,
  artStylePrompt,
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

  it('qualityBlockForFamily covers all families', () => {
    expect(qualityBlockForFamily('photo')).toMatch(/photoreal|studio/i)
    expect(qualityBlockForFamily('cgi')).toMatch(/3D|PBR|CG/i)
    expect(qualityBlockForFamily('illust')).toMatch(/illustration|silhouette/i)
    expect(qualityBlockForFamily('illust' as never)).toBeTruthy()
  })

  it('artStylePrompt follows the UI locale', () => {
    expect(artStylePrompt('comic_western', 'zh-HK')).toMatch(/必須媒介：西式漫畫/)
    expect(artStylePrompt('comic_western', 'zh-HK')).not.toMatch(
      /MANDATORY MEDIUM|WESTERN COMIC/
    )
    expect(artStylePrompt('comic_western', 'en')).toMatch(/Western comic-book/i)
    expect(artStylePrompt('comic_western', 'zh-CN')).toMatch(/必须媒介：西式漫画/)
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
