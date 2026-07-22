import { describe, expect, it } from 'vitest'
import {
  antiDefaultIdentityRules,
  inventFromProvidedSourcesRules,
  shouldInjectStoryContext,
  shouldInjectStoryContextForCharacter
} from './storyContextPolicy'

describe('storyContextPolicy', () => {
  it('never injects story from draft, soul, or empty flags', () => {
    expect(shouldInjectStoryContext({})).toBe(false)
    expect(shouldInjectStoryContext({ hasDraft: false })).toBe(false)
    expect(shouldInjectStoryContext({ hasDraft: true })).toBe(false)
    expect(shouldInjectStoryContext({ hasSoul: true })).toBe(false)
    expect(
      shouldInjectStoryContext({ hasDraft: true, hasSoul: true })
    ).toBe(false)
  })

  it('injects only when suggestFromStory is explicit', () => {
    expect(shouldInjectStoryContext({ suggestFromStory: true })).toBe(true)
    expect(
      shouldInjectStoryContext({
        hasDraft: true,
        suggestFromStory: true
      })
    ).toBe(true)
    expect(shouldInjectStoryContext({ suggestFromStory: false })).toBe(false)
  })

  it('principle rules: create + improve; no silent samples; no theme blacklist', () => {
    const zh = inventFromProvidedSourcesRules('zh-HK').join('\n')
    const en = inventFromProvidedSourcesRules('en').join('\n')
    expect(zh).toMatch(/依據來源|用戶 idea/)
    expect(zh).toMatch(/創作模式|改進模式/)
    expect(zh).toMatch(/Demo|預設世界|未出現/)
    expect(zh).not.toMatch(/雨夜|外賣|硬性禁止巴士/)
    expect(en).toMatch(/Sources of truth|user idea/i)
    expect(en).toMatch(/Create mode|Improve mode/i)
    expect(en).toMatch(/Demo seed|active story|not written in this prompt/i)
    expect(en).not.toMatch(/HARD BAN|rainy night/i)
  })

  it('never injects story context into character invent', () => {
    expect(shouldInjectStoryContextForCharacter()).toBe(false)
  })

  it('antiDefaultIdentityRules aliases invent rules', () => {
    expect(antiDefaultIdentityRules('en')).toEqual(
      inventFromProvidedSourcesRules('en')
    )
    expect(antiDefaultIdentityRules('zh-HK')).toEqual(
      inventFromProvidedSourcesRules('zh-HK')
    )
    expect(antiDefaultIdentityRules()).toEqual(
      inventFromProvidedSourcesRules('zh-HK')
    )
  })
})
