import { describe, expect, it } from 'vitest'
import {
  defaultSpeechCodeFromUi,
  parseSpokenLanguageInput,
  primarySpeechCode,
  speechLanguageDisplayName,
  speechLanguageLockLine,
  speechLanguageLockLines,
  buildSpeechLanguageLockText,
  mergeSpeechLockIntoHardRules
} from './speechLanguageLock'

describe('speechLanguageLock', () => {
  it('defaults UI locale to speech codes', () => {
    expect(defaultSpeechCodeFromUi('zh-HK')).toBe('yue')
    expect(defaultSpeechCodeFromUi('zh-TW')).toBe('yue')
    expect(defaultSpeechCodeFromUi('zh-CN')).toBe('cmn')
    expect(defaultSpeechCodeFromUi('en')).toBe('en')
    expect(defaultSpeechCodeFromUi('ja')).toBe('ja')
    expect(defaultSpeechCodeFromUi('ko-KR')).toBe('ko')
    expect(defaultSpeechCodeFromUi(null)).toBe('en')
  })

  it('parses JSON, arrays, and aliases', () => {
    expect(parseSpokenLanguageInput('["yue","en"]')).toEqual(['yue', 'en'])
    expect(parseSpokenLanguageInput(['粵語', 'English'])).toEqual(['yue', 'en'])
    expect(parseSpokenLanguageInput('  ')).toEqual([])
    expect(parseSpokenLanguageInput(null)).toEqual([])
    expect(parseSpokenLanguageInput('not-json {')).toEqual([])
  })

  it('picks primary or UI fallback', () => {
    expect(primarySpeechCode(['yue', 'en'], 'en')).toBe('yue')
    expect(primarySpeechCode([], 'zh-HK')).toBe('yue')
    expect(primarySpeechCode(undefined, 'zh-CN')).toBe('cmn')
  })

  it('names yue as Cantonese / 粵語', () => {
    expect(speechLanguageDisplayName('yue', 'zh-HK')).toMatch(/粵語|Cantonese/i)
    expect(speechLanguageDisplayName('yue', 'en')).toMatch(/Cantonese|粵語/i)
  })

  it('locks yue and forbids Mandarin/English', () => {
    const line = speechLanguageLockLine({
      name: '沈執一',
      codes: ['yue'],
      locale: 'zh-HK'
    })
    expect(line).toMatch(/SPEECH LOCK/)
    expect(line).toMatch(/沈執一/)
    expect(line).toMatch(/粵語|Cantonese/i)
    expect(line).toContain('yue')
    expect(line).toMatch(/普通話|Mandarin|英語|English/i)
  })

  it('multi-language only allows listed extras', () => {
    const line = speechLanguageLockLine({
      name: 'Ming',
      codes: ['yue', 'en'],
      locale: 'en'
    })
    expect(line).toMatch(/yue/)
    expect(line).toMatch(/en/)
    expect(line).toMatch(/ONLY if the written script|已經係以下語言/)
    expect(line).not.toMatch(/ja\)/)
  })

  it('empty cast or empty spokenLanguages does not invent a lock', () => {
    expect(speechLanguageLockLines({ characters: [], uiLocale: 'zh-HK' })).toEqual(
      []
    )
    expect(
      speechLanguageLockLines({
        characters: [{ name: 'A' }],
        uiLocale: 'zh-HK'
      })
    ).toEqual([])
    expect(
      speechLanguageLockLines({
        characters: [{ name: 'A', spokenLanguages: ['yue'] }],
        locale: 'zh-HK'
      }).length
    ).toBe(1)
  })

  it('merges lock without duplicating', () => {
    const lock = buildSpeechLanguageLockText({
      characters: [{ name: 'A', spokenLanguages: ['yue'] }],
      locale: 'zh-HK'
    })
    expect(mergeSpeechLockIntoHardRules(null, lock)).toBe(lock)
    expect(mergeSpeechLockIntoHardRules(lock, lock)).toBe(lock)
    const merged = mergeSpeechLockIntoHardRules('two hands', lock)
    expect(merged).toContain('two hands')
    expect(merged).toContain('SPEECH LOCK')
    expect(merged!.split('SPEECH LOCK').length).toBe(2)
  })
})
