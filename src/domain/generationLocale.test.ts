import { describe, expect, it } from 'vitest'
import { UI_LANGUAGES } from './uiLanguages'
import {
  detectLocaleFromText,
  resolveGenerationLocale,
  spokenCodeToUiLanguage
} from './generationLocale'

describe('generationLocale', () => {
  it('maps spoken codes onto the ten UI locales', () => {
    expect(spokenCodeToUiLanguage('yue')).toBe('zh-HK')
    expect(spokenCodeToUiLanguage('zh-Hant')).toBe('zh-HK')
    expect(spokenCodeToUiLanguage('cmn')).toBe('zh-CN')
    expect(spokenCodeToUiLanguage('zh-Hans')).toBe('zh-CN')
    expect(spokenCodeToUiLanguage('en')).toBe('en')
    expect(spokenCodeToUiLanguage('ja')).toBe('ja')
    expect(spokenCodeToUiLanguage('es')).toBe('es')
    expect(spokenCodeToUiLanguage('pt')).toBe('pt-BR')
    expect(spokenCodeToUiLanguage('ko', 'fr')).toBe('fr')
  })

  it('detects locale from LLM text', () => {
    expect(detectLocaleFromText('彼は寺の前に立つ。')).toBe('ja')
    expect(detectLocaleFromText('Он стоит у храма.')).toBe('ru')
    expect(detectLocaleFromText('هو يقف عند المعبد.')).toBe('ar')
    expect(detectLocaleFromText('वह मंदिर के सामने खड़ा है।')).toBe('hi')
    expect(detectLocaleFromText('佢喺祠堂門口企住。')).toBe('zh-HK')
    expect(detectLocaleFromText('这个人在祠堂门口站着。')).toBe('zh-CN')
    expect(detectLocaleFromText('language: ja')).toBe('ja')
  })

  it('resolveGenerationLocale prefers character speech then LLM then UI', () => {
    expect(
      resolveGenerationLocale({
        spokenLanguages: ['ja'],
        uiLanguage: 'zh-HK'
      })
    ).toBe('ja')
    expect(
      resolveGenerationLocale({
        spokenLanguages: [],
        llmHint: '日本語で書いて',
        uiLanguage: 'en'
      })
    ).toBe('ja')
    expect(
      resolveGenerationLocale({
        spokenLanguages: null,
        uiLanguage: 'fr'
      })
    ).toBe('fr')
    expect(resolveGenerationLocale({})).toBe('zh-HK')
  })

  it('covers every UI language as a possible output', () => {
    for (const { id } of UI_LANGUAGES) {
      expect(resolveGenerationLocale({ uiLanguage: id })).toBe(id)
    }
  })
})
