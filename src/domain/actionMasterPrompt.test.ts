import { describe, expect, it } from 'vitest'
import {
  ACTION_PROFILE_JSON_KEYS,
  buildActionIntroVideoPrompt,
  buildActionMasterSystemPrompt,
  buildActionMasterUserPrompt,
  buildActionPlateEditPrompt,
  buildActionPlateImagePrompt,
  extractActionProfileJson
} from './actionMasterPrompt'

describe('actionMasterPrompt', () => {
  it('system prompt requires all keys (zh + en)', () => {
    const zh = buildActionMasterSystemPrompt('zh-HK')
    expect(zh).toMatch(/必須輸出|每一個鍵|JSON/)
    expect(zh).toContain('motionNotes')
    for (const k of ACTION_PROFILE_JSON_KEYS) {
      expect(zh).toContain(k)
    }
    const en = buildActionMasterSystemPrompt('en')
    expect(en.toLowerCase()).toMatch(/json|key/)
  })

  it('user prompt includes idea and draft', () => {
    const u = buildActionMasterUserPrompt({
      locale: 'en',
      idea: 'kick door',
      draft: { name: 'Kick', description: 'boot to wood' }
    })
    expect(u).toMatch(/kick door|Kick/i)
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

  it('extractActionProfileJson from fenced text and string tags', () => {
    const a = extractActionProfileJson(
      'Here:\n```json\n{"name":"X","description":"d","visualTags":"a, b"}\n```'
    )
    expect(a.name).toBe('X')
    expect(a.visualTags).toMatch(/a/)
  })

  it('plate prompts lock motion and panels', () => {
    const profile = {
      name: 'Slash',
      description: 'wide arc',
      motionNotes: 'left to right',
      intention: 'attack',
      cameraNotes: 'side',
      visualTags: 'blade'
    }
    const img = buildActionPlateImagePrompt(profile, 'strip-3', null, [])
    expect(img).toMatch(/Slash|motion|panel|storyboard/i)
    const edit = buildActionPlateEditPrompt(profile, 'grid-2x2', null)
    expect(edit.length).toBeGreaterThan(20)
  })

  it('intro video prompt includes action bible', () => {
    const v = buildActionIntroVideoPrompt(
      {
        name: 'Bow',
        description: 'respectful bow',
        motionNotes: 'deep incline',
        intention: 'greet'
      },
      'en'
    )
    expect(v).toMatch(/Bow|motion|video|camera/i)
  })
})
