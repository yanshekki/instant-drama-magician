import { describe, expect, it } from 'vitest'
import { UI_LANGUAGES } from '../domain/uiLanguages'
import { PromptCatalog } from './PromptCatalog'
import { PROMPT_COPY_KEYS } from './copy/keys'
import { PROMPT_COPY } from './copy'

describe('PromptCatalog', () => {
  it('has every key in all ten languages', () => {
    for (const { id } of UI_LANGUAGES) {
      const table = PROMPT_COPY[id]
      for (const key of PROMPT_COPY_KEYS) {
        expect(table[key], `${id} ${key}`).toBeTypeOf('string')
        expect(table[key]!.length, `${id} ${key}`).toBeGreaterThan(0)
      }
    }
  })

  it('interpolates and does not serve English clip task for ja/ar/zh-HK', () => {
    expect(PromptCatalog.t('zh-HK', 'clip.task')).toMatch(/任務|短劇/)
    expect(PromptCatalog.t('ja', 'clip.task')).toMatch(/任務|クリップ/)
    expect(PromptCatalog.t('ja', 'clip.task')).not.toBe(
      PromptCatalog.t('en', 'clip.task')
    )
    expect(PromptCatalog.t('ar', 'intro.dossier')).toMatch(/ملف|الشخصية/)
    expect(
      PromptCatalog.t('fr', 'common.durationAspect', {
        seconds: 6,
        aspect: '16:9'
      })
    ).toContain('6')
  })

  it('ja / fr video polish is not the English skeleton', () => {
    const en = PromptCatalog.t('en', 'videoPolish.system')
    expect(PromptCatalog.t('ja', 'videoPolish.system')).not.toBe(en)
    expect(PromptCatalog.t('fr', 'videoPolish.system')).not.toBe(en)
    expect(PromptCatalog.t('fr', 'storyBeats.cast')).toMatch(/Casting/)
    expect(en).not.toMatch(/6–10s/)
    expect(PromptCatalog.t('zh-HK', 'videoPolish.system')).not.toMatch(
      /6–10 秒/
    )
  })

  it('master / improve / soul packs are native for all ten locales', () => {
    const enImprove = PromptCatalog.t('en', 'improve.mode')
    expect(PromptCatalog.t('ja', 'improve.mode')).not.toBe(enImprove)
    expect(PromptCatalog.t('zh-HK', 'improve.mode')).toMatch(/改進/)
    expect(PromptCatalog.t('ja', 'storyMeta.system')).not.toBe(
      PromptCatalog.t('en', 'storyMeta.system')
    )
    expect(PromptCatalog.t('ar', 'soul.improveMode')).not.toBe(
      PromptCatalog.t('en', 'soul.improveMode')
    )
    expect(PromptCatalog.t('fr', 'wardrobe.system')).toMatch(/costume|costume/i)
  })

  it('keyArt system prompts are native in all ten locales', () => {
    const keys = PROMPT_COPY_KEYS.filter((k) => k.startsWith('keyArt.'))
    expect(keys.length).toBeGreaterThan(10)
    const en = PROMPT_COPY.en
    for (const { id } of UI_LANGUAGES) {
      if (id === 'en') continue
      const table = PROMPT_COPY[id]
      const same = keys.filter((k) => table[k] === en[k])
      expect(same, `${id} keyArt prompt leftover`).toEqual([])
    }
    expect(PromptCatalog.t('zh-HK', 'keyArt.task')).toMatch(/劇照/)
    expect(PromptCatalog.t('zh-CN', 'keyArt.task')).toMatch(/剧照/)
    expect(PromptCatalog.t('ja', 'keyArt.lockCover')).not.toMatch(/COVER POSTER/)
  })

  it('has no leftover English lock jargon in any locale', () => {
    for (const { id } of UI_LANGUAGES) {
      for (const key of PROMPT_COPY_KEYS) {
        const v = PromptCatalog.t(id, key)
        expect(v, `${id} ${key}`).not.toMatch(
          /SPEECH LOCK|HARD RULES|IDENTITY LOCK|SPACE LOCK|CONTINUITY LOCK|GEOMETRY LOCK|PANEL COUNT IS NON-NEGOTIABLE/
        )
      }
    }
    expect(PromptCatalog.t('zh-HK', 'speechLock.named')).toMatch(/對白鎖定/)
    expect(PromptCatalog.t('ja', 'speechLock.named')).toMatch(/台詞ロック/)
    expect(PromptCatalog.t('fr', 'speechLock.named')).toMatch(/Verrouillage des répliques/)
    expect(PromptCatalog.t('en', 'speechLock.named')).toMatch(/Dialogue lock/)
    expect(PromptCatalog.t('ja', 'clip.task')).toMatch(/画像から動画/)
  })
})
