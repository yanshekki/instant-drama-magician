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
    'mediaGen.entity.continuity': '分鏡靜圖',
    'mediaGen.continuityPrev': `上一段分鏡靜圖（第 ${opts?.n ?? ''} 段）`,
    'mediaGen.continuityPrevBare': '上一段分鏡靜圖',
    'mediaGen.continuityOwn': '本段分鏡靜圖',
    'mediaGen.continuityLock': '畫面連續鎖定',
    'mediaGen.keyframeTitle': '關鍵幀靜圖',
    'characters.sheetBust': '半身胸像（對話用）',
    'characters.artPhotoDocumentary': '紀實自然光',
    'characters.artPhotoCinematic': '電影寫實（預設）',
    'actions.panelLayout_grid-2x2': '4 格（2×2）',
    'comics.layoutYonkoma': '四格漫畫 · 直向',
    'comics.layoutSplash1': '1 格 · 跨頁大圖',
    'characters.photoFallback': '參考圖',
    'keyArt.typeCover': '封面海報',
    'mediaGen.keyArtOwn': '本張成圖',
    'mediaGen.keyArtPrev': '上一張劇照'
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

  it('localizes comic-only page layouts', () => {
    const h = translateMediaGenSectionTitle(
      { entityType: 'layout', title: 'yonkoma' },
      t
    )
    expect(h).toContain('四格漫畫')
    expect(h).not.toMatch(/yonkoma/i)
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

  it('labels timeline continuity stills, not gallery boards', () => {
    expect(
      translateMediaGenSectionTitle(
        { id: 'prev_clip', entityType: 'continuity', title: '2' },
        t
      )
    ).toBe('上一段分鏡靜圖（第 2 段）')
    expect(
      translateMediaGenSectionTitle(
        { id: 'own_still', entityType: 'continuity', title: '3' },
        t
      )
    ).toBe('本段分鏡靜圖')
    expect(
      translateMediaGenSectionTitle(
        { entityType: 'gallery', title: '2' },
        t
      )
    ).toMatch(/圖庫板/)
    expect(
      translateMediaGenSectionTitle(
        { id: 'keyframe_still', entityType: 'continuity', title: 'Keyframe' },
        t
      )
    ).toBe('關鍵幀靜圖')
    expect(
      translateMediaGenSectionTitle(
        { id: 'continuity_lock', entityType: 'continuity', title: 'Continuity' },
        t
      )
    ).toBe('畫面連續鎖定')
    expect(
      translateMediaGenSectionTitle(
        { id: 'continuity_lock', entityType: 'other', title: 'Continuity' },
        t
      )
    ).toBe('畫面連續鎖定')
  })

  it('localizes key-art type and own/prev stills', () => {
    expect(
      translateMediaGenSectionTitle(
        { entityType: 'layout', title: 'cover' },
        t
      )
    ).toContain('封面海報')
    expect(
      translateMediaGenSectionTitle(
        { id: 'keyart_own', entityType: 'gallery', title: 'own' },
        t
      )
    ).toBe('本張成圖')
    expect(
      translateMediaGenSectionTitle(
        { id: 'keyart_prev', entityType: 'continuity', title: 'prev' },
        t
      )
    ).toBe('上一張劇照')
  })
})
