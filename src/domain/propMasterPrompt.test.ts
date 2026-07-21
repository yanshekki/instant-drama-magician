import { describe, expect, it } from 'vitest'
import {
  buildPropIntroVideoPrompt,
  buildPropMasterSystemPrompt,
  buildPropMasterUserPrompt,
  extractPropProfileJson
} from './propMasterPrompt'

describe('propMasterPrompt', () => {
  it('system prompt uses provided sources; invents when thin', () => {
    const zh = buildPropMasterSystemPrompt('zh-HK')
    const en = buildPropMasterSystemPrompt('en')
    expect(zh).toMatch(/依據來源|自由補齊/)
    expect(en).toMatch(/Sources of truth|invent freely/i)
  })

  it('system prompt requires every key and forbids visualTags array', () => {
    const zh = buildPropMasterSystemPrompt('zh-HK')
    expect(zh).toMatch(/必須輸出|每一個鍵/)
    expect(zh).toMatch(/visualTags/)
    expect(zh).toMatch(/禁止|陣列/)
  })

  it('extractPropProfileJson coerces visualTags array to string', () => {
    const p = extractPropProfileJson(`\`\`\`json
{
  "name": "金心項鍊",
  "description": "金色心形吊墜",
  "material": "gold",
  "sizeNotes": "2cm",
  "condition": "new",
  "visualTags": ["gold", "heart", "necklace"],
  "artStyle": "photo_cinematic"
}
\`\`\``)
    expect(p.name).toBe('金心項鍊')
    expect(p.visualTags).toBe('gold, heart, necklace')
    expect(p.material).toBe('gold')
    expect(p.artStyle).toBe('photo_cinematic')
  })

  it('extractPropProfileJson accepts visual_tags alias', () => {
    const p = extractPropProfileJson(
      JSON.stringify({
        name: 'Cup',
        description: 'Ceramic cup',
        visual_tags: 'white, ceramic'
      })
    )
    expect(p.visualTags).toBe('white, ceramic')
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
