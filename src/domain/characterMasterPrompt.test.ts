import { describe, expect, it } from 'vitest'
import {
  buildCharacterMasterSystemPrompt,
  buildCharacterSheetImagePrompt,
  extractCharacterProfileJson
} from './characterMasterPrompt'

describe('characterMasterPrompt', () => {
  it('system prompt lists required keys', () => {
    const s = buildCharacterMasterSystemPrompt('zh-HK')
    expect(s).toContain('voiceDesc')
    expect(s).toContain('mannerisms')
    expect(s).toContain('JSON')
  })

  it('extracts JSON from fenced response', () => {
    const text = `Here you go:\n\`\`\`json\n{"name":"阿明","description":"外賣仔","appearance":"短髮","voiceDesc":"低沉","mannerisms":"摸頭盔"}\n\`\`\``
    const p = extractCharacterProfileJson(text)
    expect(p.name).toBe('阿明')
    expect(p.voiceDesc).toBe('低沉')
    expect(p.mannerisms).toBe('摸頭盔')
  })

  it('builds sheet image prompt with multi-view layout', () => {
    const p = buildCharacterSheetImagePrompt({
      name: 'Ming',
      appearance: 'short hair',
      costume: 'delivery jacket'
    })
    expect(p).toMatch(/front/i)
    expect(p).toMatch(/side|back/i)
    expect(p).toContain('Ming')
  })
})
