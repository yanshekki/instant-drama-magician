import { describe, expect, it } from 'vitest'
import {
  buildPropIntroVideoPrompt,
  buildPropMasterSystemPrompt,
  buildPropMasterUserPrompt
} from './propMasterPrompt'

describe('propMasterPrompt', () => {
  it('system prompt uses provided sources; invents when thin', () => {
    const zh = buildPropMasterSystemPrompt('zh-HK')
    const en = buildPropMasterSystemPrompt('en')
    expect(zh).toMatch(/依據來源|自由補齊/)
    expect(en).toMatch(/Sources of truth|invent freely/i)
  })

  it('create mode follows idea without story injection in prompt builder', () => {
    const u = buildPropMasterUserPrompt({
      idea: '生鏽懷錶',
      locale: 'zh-HK'
    })
    expect(u).toContain('生鏽懷錶')
    expect(u).not.toMatch(/可選製作上下文/)
  })

  it('buildPropIntroVideoPrompt locks object identity', () => {
    const zh = buildPropIntroVideoPrompt(
      {
        name: '懷錶',
        description: '生鏽銀殼',
        material: 'silver',
        condition: 'worn'
      },
      'zh-HK'
    )
    expect(zh).toMatch(/物件鎖定/)
    expect(zh).toContain('懷錶')
    expect(zh).toContain('silver')
  })
})
