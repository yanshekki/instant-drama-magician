import { describe, expect, it } from 'vitest'
import { UI_LANGUAGES } from '../domain/uiLanguages'
import {
  hardRuleTags,
  outputLanguageLock,
  promptTemplateId,
  resolvePromptContext
} from './resolve'

describe('resolvePromptContext', () => {
  it('maps every UI language to itself as output', () => {
    for (const { id } of UI_LANGUAGES) {
      expect(resolvePromptContext(id).output).toBe(id)
    }
  })

  it('uses zh skeleton for Chinese, en skeleton otherwise', () => {
    expect(promptTemplateId('zh-HK')).toBe('zh-HK')
    expect(promptTemplateId('zh-CN')).toBe('zh-HK')
    expect(promptTemplateId('en')).toBe('en')
    expect(promptTemplateId('ja')).toBe('en')
    expect(promptTemplateId('es')).toBe('en')
  })

  it('loads a dedicated pack for every UI language', () => {
    for (const { id } of UI_LANGUAGES) {
      const ctx = resolvePromptContext(id)
      expect(ctx.pack.id).toBe(id)
      expect(ctx.pack.hardRulesFallback.character.length).toBeGreaterThan(10)
      expect(ctx.pack.outputLock.length).toBeGreaterThan(20)
      expect(ctx.imagePolishDirective).toBe(ctx.pack.imagePolishDirective)
    }
  })

  it('does not treat Japanese UI as English output or English pack', () => {
    const ctx = resolvePromptContext('ja')
    expect(ctx.output).toBe('ja')
    expect(ctx.pack.id).toBe('ja')
    expect(ctx.languageName).toBe('日本語')
    expect(ctx.outputLock).toContain('日本語')
    expect(ctx.pack.hardRulesFallback.character).toContain('【必須】')
  })

  it('uses Latin MUST tags for English, Chinese brackets for zh', () => {
    expect(hardRuleTags('en')).toEqual({
      must: '[MUST]',
      mustNot: '[MUST NOT]'
    })
    expect(hardRuleTags('zh-HK').must).toBe('【必須】')
    expect(hardRuleTags('zh-CN').must).toBe('【必须】')
    expect(hardRuleTags('ja').must).toBe('【必須】')
  })

  it('locks output language and forbids mixed tags', () => {
    const lock = outputLanguageLock('en')
    expect(lock).toMatch(/English/)
    expect(lock).toContain('[MUST]')
    expect(lock).not.toMatch(/【必須】/)
    expect(outputLanguageLock('fr')).toContain('français')
    expect(outputLanguageLock('ar')).toContain('العربية')
  })
})
