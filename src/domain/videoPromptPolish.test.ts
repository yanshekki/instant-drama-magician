import { describe, expect, it } from 'vitest'
import {
  extractPolishedVideoPrompt,
  truncateForVideoPrompt,
  buildIntroVideoPolishUserPrompt,
  buildSceneIntroVideoPolishUserPrompt,
  buildPropIntroVideoPolishUserPrompt,
  buildCostumeIntroVideoPolishUserPrompt,
  buildClipVideoPolishUserPrompt
} from './videoPromptPolish'

describe('extractPolishedVideoPrompt', () => {
  it('strips markdown fences', () => {
    const raw = '```text\nIMAGE-TO-VIDEO: hero walks in rain.\n```'
    expect(extractPolishedVideoPrompt(raw)).toBe(
      'IMAGE-TO-VIDEO: hero walks in rain.'
    )
  })

  it('strips prompt labels', () => {
    expect(extractPolishedVideoPrompt('Prompt: cinematic push-in on face')).toBe(
      'cinematic push-in on face'
    )
    expect(extractPolishedVideoPrompt('提示詞：角色望向鏡頭微笑')).toBe(
      '角色望向鏡頭微笑'
    )
  })

  it('returns empty for blank', () => {
    expect(extractPolishedVideoPrompt('   ')).toBe('')
  })
})

describe('truncateForVideoPrompt', () => {
  it('truncates long soul', () => {
    const s = 'a'.repeat(100)
    const out = truncateForVideoPrompt(s, 50)
    expect(out.length).toBeLessThan(s.length)
    expect(out).toContain('[truncated]')
  })
})

describe('buildIntroVideoPolishUserPrompt', () => {
  it('includes dossier fields and soul', () => {
    const u = buildIntroVideoPolishUserPrompt({
      locale: 'zh-HK',
      seconds: 10,
      aspectRatio: '16:9',
      hasRefImage: true,
      fallbackPrompt: 'TEMPLATE FALLBACK',
      name: '小雨',
      appearance: '銀髮',
      backstory: '雨夜獨行',
      relationships: '與阿明有過往',
      spokenLanguages: ['yue', 'en'],
      soulExcerpt: '## 身份\n短劇主角'
    })
    expect(u).toContain('小雨')
    expect(u).toContain('銀髮')
    expect(u).toContain('雨夜獨行')
    expect(u).toContain('與阿明有過往')
    expect(u).toContain('soul.md')
    expect(u).toContain('TEMPLATE FALLBACK')
    expect(u).toContain('yue')
  })
})

describe('buildSceneIntroVideoPolishUserPrompt', () => {
  it('includes location dossier and space lock task', () => {
    const u = buildSceneIntroVideoPolishUserPrompt({
      locale: 'zh-HK',
      seconds: 10,
      aspectRatio: '16:9',
      hasRefImage: true,
      fallbackPrompt: 'SCENE TEMPLATE',
      title: '碼頭倉庫',
      description: '鏽鐵門與濕潤碼頭',
      timeOfDay: 'night',
      weather: 'rain',
      mood: 'tense',
      lighting: 'neon spill'
    })
    expect(u).toContain('場景介紹')
    expect(u).toContain('碼頭倉庫')
    expect(u).toContain('鏽鐵門')
    expect(u).toContain('rain')
    expect(u).toContain('SCENE TEMPLATE')
    expect(u).toMatch(/空間身份/)
  })
})

describe('buildPropIntroVideoPolishUserPrompt', () => {
  it('includes prop dossier', () => {
    const u = buildPropIntroVideoPolishUserPrompt({
      locale: 'zh-HK',
      seconds: 10,
      hasRefImage: true,
      fallbackPrompt: 'PROP TEMPLATE',
      name: '懷錶',
      description: '生鏽銀殼',
      material: 'silver'
    })
    expect(u).toContain('道具')
    expect(u).toContain('懷錶')
    expect(u).toContain('PROP TEMPLATE')
  })
})

describe('buildCostumeIntroVideoPolishUserPrompt', () => {
  it('includes costume dossier', () => {
    const u = buildCostumeIntroVideoPolishUserPrompt({
      locale: 'en',
      seconds: 10,
      hasRefImage: true,
      fallbackPrompt: 'COSTUME TEMPLATE',
      name: 'Rain coat',
      description: 'black leather trench'
    })
    expect(u).toMatch(/Costume|wardrobe/i)
    expect(u).toContain('Rain coat')
    expect(u).toContain('COSTUME TEMPLATE')
  })
})

describe('buildClipVideoPolishUserPrompt', () => {
  it('includes revision and beat', () => {
    const u = buildClipVideoPolishUserPrompt({
      locale: 'en',
      seconds: 6,
      hasRefImage: true,
      fallbackPrompt: 'CLIP TEMPLATE',
      storyTitle: 'Demo',
      beatOrDialogue: 'Hello',
      revisionPrompt: 'only two hands'
    })
    expect(u).toContain('Demo')
    expect(u).toContain('Hello')
    expect(u).toContain('only two hands')
    expect(u).toContain('CLIP TEMPLATE')
  })

  it('includes labeled hardRules materials', () => {
    const u = buildClipVideoPolishUserPrompt({
      locale: 'en',
      seconds: 10,
      hasRefImage: false,
      fallbackPrompt: 'CLIP',
      storyTitle: 'S',
      hardRules: '[Character · Keith]\n【必須】two hands'
    })
    expect(u).toContain('HARD RULES')
    expect(u).toContain('[Character · Keith]')
    expect(u).toContain('two hands')
  })
})

describe('buildIntroVideoPolishUserPrompt hardRules', () => {
  it('embeds entity hardRules for polish materials', () => {
    const u = buildIntroVideoPolishUserPrompt({
      locale: 'zh-HK',
      seconds: 10,
      hasRefImage: true,
      fallbackPrompt: 'CHAR TEMPLATE',
      name: '小雨',
      hardRules: '【禁止】第三人臉'
    })
    expect(u).toContain('HARD RULES')
    expect(u).toContain('第三人臉')
    expect(u).toContain('CHAR TEMPLATE')
  })
})
