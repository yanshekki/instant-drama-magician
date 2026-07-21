import { describe, expect, it } from 'vitest'
import {
  buildWardrobeSuggestSystemPrompt,
  buildWardrobeSuggestUserPrompt,
  extractWardrobeSuggestionJson
} from './wardrobeSuggest'

describe('wardrobeSuggest', () => {
  it('system prompt lists art styles and invents when thin', () => {
    const s = buildWardrobeSuggestSystemPrompt('en')
    expect(s).toMatch(/photo_cinematic/)
    expect(s).toMatch(/JSON/)
    expect(s).toMatch(/invent/i)
    const zh = buildWardrobeSuggestSystemPrompt('zh-HK')
    expect(zh).toMatch(/自由|造型/)
  })


  it('user prompt includes character and scenes', () => {
    const u = buildWardrobeSuggestUserPrompt({
      characterName: 'Aiko',
      appearance: 'black hair',
      sceneSnippets: ['Rainy alley chase'],
      locale: 'en'
    })
    expect(u).toMatch(/Aiko/)
    expect(u).toMatch(/Rainy alley/)
  })

  it('parses suggestion JSON', () => {
    const r = extractWardrobeSuggestionJson(
      '```json\n{"name":"Night","costume":"leather jacket","artStyle":"anime_modern","rationale":"fits chase"}\n```'
    )
    expect(r.name).toBe('Night')
    expect(r.costume).toMatch(/leather/)
    expect(r.artStyle).toBe('anime_modern')
  })

  it('falls back unknown artStyle', () => {
    const r = extractWardrobeSuggestionJson(
      '{"name":"X","costume":"robe","artStyle":"not_real","rationale":""}'
    )
    expect(r.artStyle).toBe('photo_cinematic')
  })

  it('user prompt includes full character extras and empty scenes', () => {
    const u = buildWardrobeSuggestUserPrompt({
      characterName: '阿明',
      description: '外賣',
      appearance: '短髮',
      personality: '固執',
      ageRange: '20s',
      gender: 'm',
      mannerisms: '摸頭盔',
      visualTags: 'urban',
      currentCostume: '雨衣',
      existingCostumeNames: ['日常'],
      soulExcerpt: '## 身份\n鐵工',
      storyTitle: '雨夜',
      styleNote: 'neon',
      segmentLabel: '重逢',
      userRequest: '更正式',
      sceneSnippets: [],
      locale: 'zh-HK'
    })
    expect(u).toContain('阿明')
    expect(u).toContain('雨衣')
    expect(u).toContain('雨夜')
    expect(u).toContain('更正式')
    expect(u).toMatch(/尚無場景|no scenes/i)
  })

  it('extractWardrobeSuggestionJson rejects empty costume', () => {
    expect(() =>
      extractWardrobeSuggestionJson('{"name":"X","costume":"","artStyle":"photo_cinematic"}')
    ).toThrow()
    expect(() => extractWardrobeSuggestionJson('not json')).toThrow()
  })
})
