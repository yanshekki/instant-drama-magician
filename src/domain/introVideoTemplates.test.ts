import { describe, expect, it } from 'vitest'
import {
  DEFAULT_INTRO_VIDEO_TEMPLATE,
  INTRO_VIDEO_TEMPLATES,
  applyCameraTemplateStillMaterials,
  introDirectorLocale,
  introTemplatePolishBlock,
  introTemplateStillBlock,
  isIntroVideoTemplateId,
  mediaGenKindUsesCameraTemplate,
  mergeCameraTemplateIntoStillPrompt,
  mergeIntroTemplateUserExtra,
  parseIntroVideoTemplateId,
  resolveCameraTemplateId
} from './introVideoTemplates'

describe('introVideoTemplates', () => {
  it('catalog keeps the original eight ids and adds camera templates', () => {
    expect(INTRO_VIDEO_TEMPLATES).toHaveLength(18)
    expect(DEFAULT_INTRO_VIDEO_TEMPLATE).toBe('hero-walkin')
    expect(isIntroVideoTemplateId('identity-lock')).toBe(false)
    expect(isIntroVideoTemplateId('follow-asset')).toBe(true)
    expect(isIntroVideoTemplateId('low-angle-hero')).toBe(true)
    expect(isIntroVideoTemplateId('slow-motion')).toBe(true)
    expect(parseIntroVideoTemplateId('nope')).toBeUndefined()
    expect(parseIntroVideoTemplateId('close-up')).toBe('close-up')
  })

  it('director locale maps English vs others', () => {
    expect(introDirectorLocale('en')).toBe('en')
    expect(introDirectorLocale('en-US')).toBe('en')
    expect(introDirectorLocale('zh-HK')).toBe('zh-HK')
    expect(introDirectorLocale('ja')).toBe('zh-HK')
  })

  it('polish block includes template id and director line', () => {
    const en = introTemplatePolishBlock('hero-walkin', 'en')
    expect(en).toContain('hero-walkin')
    expect(en).toMatch(/Hero walk-in/i)
    const zh = introTemplatePolishBlock('talking-head', 'zh-HK')
    expect(zh).toContain('talking-head')
    expect(zh).toMatch(/鏡頭表演範本/)
    expect(zh).toMatch(/對鏡/)
    expect(zh).not.toMatch(/嘅|喺|跟住|template/)
    const still = introTemplateStillBlock('low-angle-hero', 'zh-HK')
    expect(still).toContain('low-angle-hero')
    expect(still).toMatch(/鏡頭靜圖範本/)
    expect(still).not.toMatch(/嘅|喺|跟住|template/)
    for (const tpl of INTRO_VIDEO_TEMPLATES) {
      expect(tpl.director['zh-HK'], tpl.id).not.toMatch(/嘅|喺|跟住|入面|讀得明|肩膊/)
      expect(tpl.stillPrompt['zh-HK'], tpl.id).not.toMatch(/嘅|喺|跟住|入面|讀得明|肩膊/)
    }
  })

  it('merges template then extra; skips invalid id', () => {
    expect(mergeIntroTemplateUserExtra(undefined, '  neon  ', 'en')).toBe(
      'neon'
    )
    expect(mergeIntroTemplateUserExtra('nope', null, 'en')).toBeNull()
    const merged = mergeIntroTemplateUserExtra(
      'action-beat',
      'keep the rain',
      'en'
    )
    expect(merged).toContain('action-beat')
    expect(merged).toContain('keep the rain')
  })

  it('camera-template kinds cover single shots, not sheets or plates', () => {
    expect(mediaGenKindUsesCameraTemplate('timeline-still')).toBe(true)
    expect(mediaGenKindUsesCameraTemplate('key-art')).toBe(true)
    expect(mediaGenKindUsesCameraTemplate('story-cover')).toBe(true)
    expect(mediaGenKindUsesCameraTemplate('character-photoshoot')).toBe(true)
    expect(mediaGenKindUsesCameraTemplate('timeline-clip')).toBe(true)
    expect(mediaGenKindUsesCameraTemplate('character-intro')).toBe(true)
    expect(mediaGenKindUsesCameraTemplate('character-sheet')).toBe(false)
    expect(mediaGenKindUsesCameraTemplate('scene-plate')).toBe(false)
    expect(mediaGenKindUsesCameraTemplate('comic-page')).toBe(false)
    expect(mediaGenKindUsesCameraTemplate('costume-swap')).toBe(false)
  })

  it('resolves payload over stored camera id', () => {
    expect(resolveCameraTemplateId('close-up', 'hero-walkin')).toBe('close-up')
    expect(resolveCameraTemplateId(null, 'pov')).toBe('pov')
    expect(resolveCameraTemplateId('nope', 'handheld')).toBe('handheld')
    expect(resolveCameraTemplateId('nope', 'also-nope')).toBeUndefined()
  })

  it('injects still camera section and prompt block', () => {
    const applied = applyCameraTemplateStillMaterials(
      [
        {
          id: 'task',
          kind: 'prompt-block',
          title: 'beat',
          text: 'chase',
          include: true
        }
      ],
      'chase',
      'low-angle-hero',
      'en'
    )
    expect(applied.sections.some((s) => s.id === 'camera_template')).toBe(true)
    expect(applied.fallbackPrompt).toContain('low-angle-hero')
    const again = applyCameraTemplateStillMaterials(
      applied.sections,
      applied.fallbackPrompt,
      'low-angle-hero',
      'en'
    )
    expect(again.sections.filter((s) => s.id === 'camera_template')).toHaveLength(
      1
    )
    expect(
      mergeCameraTemplateIntoStillPrompt('base still', 'pov', 'en')
    ).toContain('pov')
    expect(mergeCameraTemplateIntoStillPrompt('base', 'nope', 'en')).toBe('base')
  })
})
