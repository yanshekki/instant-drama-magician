import { describe, expect, it } from 'vitest'
import {
  classifySex,
  mergeSexIntoHardRules,
  sexPromptLock
} from './sexLock'

describe('sexLock', () => {
  it('classifies common male and female labels', () => {
    expect(classifySex('男')).toBe('male')
    expect(classifySex('男性')).toBe('male')
    expect(classifySex('m')).toBe('male')
    expect(classifySex('male')).toBe('male')
    expect(classifySex('女')).toBe('female')
    expect(classifySex('女性')).toBe('female')
    expect(classifySex('道士')).toBeNull()
    expect(classifySex('')).toBeNull()
  })

  it('front-loads a male lock that forbids drawing a woman', () => {
    const lock = sexPromptLock('男', 'zh-HK')
    expect(lock).toMatch(/成年男性|男性/)
    expect(lock).toMatch(/女人|女性/)
  })

  it('merges sex HARD RULES without dropping existing lines', () => {
    const merged = mergeSexIntoHardRules(
      '【必須】恰好兩隻手',
      '男',
      '沈執一',
      'zh-HK'
    )
    expect(merged).toMatch(/恰好兩隻手/)
    expect(merged).toMatch(/沈執一/)
    expect(merged).toMatch(/【禁止】/)
    expect(merged).toMatch(/女人|女性/)
  })
})
