import { describe, expect, it } from 'vitest'
import {
  assembleSystemPrompt,
  compareAxesForFamily,
  COPY_TEMPLATE_IDS,
  defaultTemplateId,
  flagsForTemplate,
  MEDIA_TEMPLATE_IDS,
  recipeCompareScores,
  recipeStarOn,
  resolvePromptTemplate,
  shouldFillMissingKeys,
  shouldForceCinematic,
  shouldPersistHardRulesFallback
} from './promptTemplates'

describe('promptTemplates', () => {
  it('defaults to safe recipes', () => {
    expect(defaultTemplateId('copy')).toBe('polish-only')
    expect(defaultTemplateId('media')).toBe('follow-asset')
    expect(resolvePromptTemplate('nope', 'copy')).toBe('polish-only')
    expect(resolvePromptTemplate('invent', 'copy')).toBe('invent')
    expect(resolvePromptTemplate('identity-lock', 'media')).toBe('identity-lock')
  })

  it('keeps invent/world/speech off unless chosen', () => {
    const polish = flagsForTemplate('polish-only')
    expect(polish.inventWorld).toBe(false)
    expect(polish.injectStory).toBe(false)
    expect(polish.speechLockIfEmpty).toBe(false)
    expect(polish.persistHardRulesFallback).toBe(false)
    expect(polish.fakePersonaFallback).toBe(false)
    expect(flagsForTemplate('invent').inventWorld).toBe(true)
    expect(flagsForTemplate('from-story').injectStory).toBe(true)
    expect(flagsForTemplate('cinematic-lock').forceCinematic).toBe(true)
    expect(flagsForTemplate('restyle').allowRestyle).toBe(true)
    expect(shouldFillMissingKeys('polish-only')).toBe(false)
    expect(shouldFillMissingKeys('fill-blanks')).toBe(true)
    expect(shouldFillMissingKeys('invent')).toBe(true)
    expect(shouldPersistHardRulesFallback('polish-only')).toBe(false)
    expect(shouldForceCinematic('follow-asset')).toBe(false)
    expect(shouldForceCinematic('cinematic-lock')).toBe(true)
  })

  it('appends localized recipe onto a system base', () => {
    const zh = assembleSystemPrompt({
      base: 'BASE',
      locale: 'zh-HK',
      templateId: 'polish-only'
    })
    expect(zh).toContain('BASE')
    expect(zh).toMatch(/潤飾|已填|不要發明/)
    const en = assembleSystemPrompt({
      base: 'BASE',
      locale: 'en',
      templateId: 'invent',
      family: 'copy'
    })
    expect(en).toMatch(/invent|create freely/i)
    expect(en).not.toBe(zh)
  })

  it('gives every recipe three 1–5 compare stars', () => {
    for (const id of COPY_TEMPLATE_IDS) {
      const axes = compareAxesForFamily('copy')
      expect(axes).toEqual(['keepWorld', 'fillGaps', 'followStory'])
      const scores = recipeCompareScores(id)
      expect(Object.keys(scores)).toHaveLength(3)
      for (const axis of axes) {
        const n = recipeStarOn(id, axis)
        expect(n).toBeGreaterThanOrEqual(1)
        expect(n).toBeLessThanOrEqual(5)
      }
    }
    for (const id of MEDIA_TEMPLATE_IDS) {
      const axes = compareAxesForFamily('media')
      expect(axes).toHaveLength(3)
      expect(Object.keys(recipeCompareScores(id))).toHaveLength(3)
    }
    expect(recipeStarOn('polish-only', 'keepWorld')).toBe(5)
    expect(recipeStarOn('invent', 'keepWorld')).toBe(1)
    expect(recipeStarOn('from-story', 'followStory')).toBe(5)
    expect(recipeStarOn('cinematic-lock', 'cinematic')).toBe(5)
    expect(recipeStarOn('follow-asset', 'followAsset')).toBe(5)
  })
})
