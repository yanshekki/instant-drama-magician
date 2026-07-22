import { describe, expect, it } from 'vitest'
import {
  parseMediaGenTitleId,
  translateMediaGenSectionTitle
} from './mediaGenSectionTitleI18n'

/** Minimal t(): returns zh-HK-like labels for known keys, else key. */
function t(key: string, opts?: Record<string, unknown>): string {
  const map: Record<string, string> = {
    'mediaGen.entity.layout': '格位',
    'mediaGen.entity.art': '畫風',
    'mediaGen.entity.character': '角色',
    'mediaGen.entity.gallery': '圖庫',
    'mediaGen.hardRulesTitle': '鐵則',
    'mediaGen.layoutTitle': `格位 · ${opts?.id ?? ''}`,
    'mediaGen.galleryBoard': `圖庫板 ${opts?.n ?? ''}`,
    'characters.sheetBust': '半身胸像（對話用）',
    'characters.artPhotoDocumentary': '紀實自然光',
    'characters.artPhotoCinematic': '電影寫實（預設）',
    'actions.panelLayout_grid-2x2': '4 格（2×2）',
    'characters.photoFallback': '參考圖'
  }
  return map[key] ?? key
}

describe('mediaGenSectionTitleI18n', () => {
  it('parseMediaGenTitleId takes token before middot', () => {
    expect(parseMediaGenTitleId('bust · Bust portrait')).toBe('bust')
    expect(parseMediaGenTitleId('photo_documentary')).toBe('photo_documentary')
    expect(parseMediaGenTitleId('grid-2x2 · 4')).toBe('grid-2x2')
  })

  it('localizes character sheet layout package', () => {
    const h = translateMediaGenSectionTitle(
      {
        entityType: 'layout',
        title: 'bust · Bust portrait'
      },
      t
    )
    expect(h).toContain('半身胸像')
    expect(h).not.toMatch(/Bust portrait/i)
    expect(h).not.toMatch(/\bbust\b/)
  })

  it('localizes art style id', () => {
    const h = translateMediaGenSectionTitle(
      { entityType: 'art', title: 'photo_documentary' },
      t
    )
    expect(h).toContain('畫風')
    expect(h).toContain('紀實自然光')
    expect(h).not.toMatch(/photo_documentary/)
  })

  it('localizes action panel layout', () => {
    const h = translateMediaGenSectionTitle(
      { entityType: 'layout', title: 'grid-2x2 · 4' },
      t
    )
    expect(h).toContain('2×2')
    expect(h).not.toMatch(/grid-2x2/)
  })

  it('hard rules and profile keep expected shape', () => {
    expect(
      translateMediaGenSectionTitle(
        { entityType: 'hardRules', title: 'HARD RULES' },
        t
      )
    ).toBe('鐵則')
    const profile = translateMediaGenSectionTitle(
      {
        entityType: 'character',
        title: 'Kana Momonogi'
      },
      t
    )
    expect(profile).toContain('角色')
    expect(profile).toContain('Kana Momonogi')
  })
})
