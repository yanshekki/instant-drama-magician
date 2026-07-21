import { describe, expect, it } from 'vitest'
import {
  coerceProfileString,
  coerceProfileStringFrom,
  extractJsonObject,
  profileCompletenessRules
} from './jsonProfileFields'

describe('jsonProfileFields', () => {
  it('coerceProfileString handles string / array / number', () => {
    expect(coerceProfileString('  gold  ')).toBe('gold')
    expect(coerceProfileString(['gold', ' necklace ', ''])).toBe(
      'gold, necklace'
    )
    expect(coerceProfileString(42)).toBe('42')
    expect(coerceProfileString('')).toBeUndefined()
    expect(coerceProfileString([])).toBeUndefined()
    expect(coerceProfileString(null)).toBeUndefined()
  })

  it('coerceProfileStringFrom uses aliases', () => {
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
  })

  it('extractJsonObject tolerates fences and prose', () => {
    const o = extractJsonObject(
      'Here:\n```json\n{"name":"Watch","visualTags":["a","b"]}\n```\n'
    )
    expect(o.name).toBe('Watch')
    expect(Array.isArray(o.visualTags)).toBe(true)
  })

  it('extractJsonObject throws when missing', () => {
    expect(() => extractJsonObject('no json here')).toThrow(/No JSON/)
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
