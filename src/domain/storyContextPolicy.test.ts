import { describe, expect, it } from 'vitest'
import {
  inventFromProvidedSourcesRules,
  shouldInjectStoryContext,
  shouldInjectStoryContextForCharacter
} from './storyContextPolicy'

describe('storyContextPolicy', () => {
  it('does not inject story on pure invent-from-idea', () => {
    expect(shouldInjectStoryContext({})).toBe(false)
    expect(shouldInjectStoryContext({ hasDraft: false })).toBe(false)
  })

  it('injects when refining draft, soul, or suggestFromStory', () => {
    expect(shouldInjectStoryContext({ hasDraft: true })).toBe(true)
    expect(shouldInjectStoryContext({ hasSoul: true })).toBe(true)
    expect(shouldInjectStoryContext({ suggestFromStory: true })).toBe(true)
  })

  it('principle rules: use provided sources; invent if thin; no theme blacklist', () => {
    const zh = inventFromProvidedSourcesRules('zh-HK').join('\n')
    const en = inventFromProvidedSourcesRules('en').join('\n')
    expect(zh).toMatch(/依據來源|用戶 idea/)
    expect(zh).toMatch(/自由補齊|空白/)
    expect(zh).not.toMatch(/雨夜|外賣|硬性禁止/)
    expect(en).toMatch(/Sources of truth|user idea/i)
    expect(en).toMatch(/invent freely/i)
    expect(en).not.toMatch(/HARD BAN|rainy night|Demo story/i)
  })

  it('never injects story context into character invent', () => {
    expect(shouldInjectStoryContextForCharacter()).toBe(false)
  })
})
