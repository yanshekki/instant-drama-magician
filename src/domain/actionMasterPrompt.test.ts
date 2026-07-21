import { describe, expect, it } from 'vitest'
import {
  buildActionMasterSystemPrompt,
  extractActionProfileJson
} from './actionMasterPrompt'

describe('actionMasterPrompt', () => {
  it('system prompt requires all keys', () => {
    const zh = buildActionMasterSystemPrompt('zh-HK')
    expect(zh).toMatch(/必須輸出|每一個鍵/)
    expect(zh).toContain('motionNotes')
    expect(zh).toMatch(/visualTags/)
  })

  it('extractActionProfileJson coerces visualTags array', () => {
    const a = extractActionProfileJson(
      JSON.stringify({
        name: 'Draw sword',
        description: 'Hero draws steel',
        motionNotes: 'right hand hip to high',
        intention: 'threat',
        cameraNotes: 'slow push',
        visualTags: ['sword', 'combat', 'rain']
      })
    )
    expect(a.name).toBe('Draw sword')
    expect(a.visualTags).toBe('sword, combat, rain')
    expect(a.motionNotes).toMatch(/right hand/)
  })
})
