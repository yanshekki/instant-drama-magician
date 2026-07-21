import { describe, expect, it } from 'vitest'
import { AppError } from '../types/errors'
import {
  VISUAL_TAGS_KEYS,
  coerceProfileString,
  coerceProfileStringFrom,
  extractJsonObject,
  profileCompletenessRules,
  synthesizeVisualTagsFromText
} from './jsonProfileFields'

describe('jsonProfileFields', () => {
  it('coerceProfileString handles string / array / number / boolean / object', () => {
    expect(coerceProfileString('  gold  ')).toBe('gold')
    expect(coerceProfileString(['gold', ' necklace ', ''])).toBe(
      'gold, necklace'
    )
    expect(coerceProfileString([1, true, false, { x: 1 }])).toBe(
      '1, true, false'
    )
    expect(coerceProfileString(42)).toBe('42')
    expect(coerceProfileString(true)).toBe('true')
    expect(coerceProfileString('')).toBeUndefined()
    expect(coerceProfileString([])).toBeUndefined()
    expect(coerceProfileString(null)).toBeUndefined()
    expect(coerceProfileString(undefined)).toBeUndefined()
    expect(coerceProfileString({ en: 'gold, heart' })).toBe('gold, heart')
    expect(coerceProfileString({ tags: ['a', 'b'] })).toBe('a, b')
    expect(coerceProfileString({ value: 'x' })).toBe('x')
    expect(coerceProfileString({ text: 'y' })).toBe('y')
    expect(coerceProfileString({ foo: 'one', bar: 'two' })).toMatch(/one/)
    expect(coerceProfileString({ empty: '' })).toBeUndefined()
  })

  it('coerceProfileStringFrom uses aliases and case-insensitive keys', () => {
    expect(
      coerceProfileStringFrom(
        { visual_tags: ['a', 'b'], visualTags: '' },
        ['visualTags', 'visual_tags', 'tags']
      )
    ).toBe('a, b')
    expect(
      coerceProfileStringFrom({ tags: 'x, y' }, [
        'visualTags',
        'visual_tags',
        'tags'
      ])
    ).toBe('x, y')
    expect(
      coerceProfileStringFrom({ VisualTags: 'case-ok' }, ['visualTags'])
    ).toBe('case-ok')
    expect(coerceProfileStringFrom({}, ['visualTags'])).toBeUndefined()
    expect(VISUAL_TAGS_KEYS).toContain('visualTags')
    expect(VISUAL_TAGS_KEYS).toContain('標籤')
  })

  it('extractJsonObject tolerates fences and prose', () => {
    const o = extractJsonObject(
      'Here:\n```json\n{"name":"Watch","visualTags":["a","b"]}\n```\n'
    )
    expect(o.name).toBe('Watch')
    expect(Array.isArray(o.visualTags)).toBe(true)
  })

  it('extractJsonObject throws on empty / array / missing braces', () => {
    expect(() => extractJsonObject('')).toThrow(AppError)
    expect(() => extractJsonObject('no json here')).toThrow(
      /errors\.noJsonInModelResponse/
    )
    expect(() => extractJsonObject('[1,2,3]')).toThrow()
    expect(() => extractJsonObject('{"broken"')).toThrow()
    // object braces but JSON.parse yields array
    expect(() => extractJsonObject('{"a":1} trailing {not')).not.toThrow()
    expect(() => extractJsonObject('{]')).toThrow()
  })

  it('synthesizeVisualTagsFromText latin + cjk + empty', () => {
    expect(synthesizeVisualTagsFromText([])).toBeUndefined()
    expect(synthesizeVisualTagsFromText([null, '  '])).toBeUndefined()
    const en = synthesizeVisualTagsFromText([
      'A golden heart necklace with silver chain'
    ])
    expect(en).toMatch(/golden|heart|necklace/)
    expect(en).not.toMatch(/\bthe\b|\band\b/)
    const cjk = synthesizeVisualTagsFromText(['金色心形項鍊吊墜'])
    expect(cjk).toBeTruthy()
    expect(cjk!.length).toBeLessThanOrEqual(48)
  })

  it('profileCompletenessRules mentions every key and forbids tag arrays', () => {
    const zh = profileCompletenessRules(['name', 'visualTags'], 'zh-HK').join(
      '\n'
    )
    expect(zh).toContain('name')
    expect(zh).toContain('visualTags')
    expect(zh).toMatch(/禁止|陣列/)
    const en = profileCompletenessRules(['name', 'visualTags'], 'en').join('\n')
    expect(en).toMatch(/NEVER|MUST/i)
  })
})
