import { describe, expect, it } from 'vitest'
import {
  assembleSystemPrompt,
  defaultTemplateId,
  flagsForTemplate,
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
    expect(zh).toMatch(/潤飾|已填|唔好發明|不要發明/)
    const en = assembleSystemPrompt({
      base: 'BASE',
      locale: 'en',
      templateId: 'invent',
      family: 'copy'
    })
    expect(en).toMatch(/invent|create freely/i)
    expect(en).not.toBe(zh)
  })
})
