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

    const zh = buildActionIntroVideoPrompt(
      {
        name: '鞠躬',
        description: '禮貌鞠躬',
        motionNotes: '深彎',
        intention: '致意',
        cameraNotes: '側跟',
        visualTags: 'formal',
        hardRules: '禁止水印'
      },
      'zh-HK'
    )
    expect(zh).toContain('鞠躬')
    expect(zh).toMatch(/動作|鏡頭|禁止/)
  })

  it('user prompt improve mode zh with draft', () => {
    const u = buildActionMasterUserPrompt({
      locale: 'zh-HK',
      idea: '更慢',
      existingDraft: {
        name: '拔刀',
        description: '英雄拔刀',
        motionNotes: '右手胯到高',
        intention: '威脅'
      }
    })
    expect(u).toMatch(/拔刀|英雄|更慢/)
  })

  it('plate image prompt with cast refs and hard rules', () => {
    const img = buildActionPlateImagePrompt(
      {
        name: 'Slash',
        description: 'wide arc',
        motionNotes: 'L→R',
        hardRules: '【禁止】水印'
      },
      'grid-2x2',
      'photo_cinematic',
      [
        {
          entityType: 'character',
          entityId: 'c1',
          entityName: 'Ming',
          roleHint: 'hero'
        }
      ]
    )
    expect(img).toMatch(/Slash|Ming|禁止|panel|grid/i)

    const edit = buildActionPlateEditPrompt(
      { name: 'Slash', description: 'arc', hardRules: 'NO logo' },
      'strip-3',
      'anime_modern'
    )
    expect(edit).toMatch(/EDIT|Slash|anime|NO logo/i)
  })

  it('user prompt en with story/style and empty cast plate path', () => {
    const u = buildActionMasterUserPrompt({
      locale: 'en',
      idea: 'kick door',
      storyTitle: 'Rain',
      styleNote: 'neon',
      existingDraft: { name: 'Kick' }
    })
    expect(u).toMatch(/Story context|Style note|Existing draft|kick door/i)

    const emptyCast = buildActionPlateImagePrompt(
      { name: 'X' },
      'grid-2x3',
      null,
      []
    )
    expect(emptyCast).toMatch(/No cast stills|SIX|2x3/i)
  })

  it('extractActionProfileJson synthesizes tags and falls back on garbage', () => {
    const a = extractActionProfileJson(
      JSON.stringify({
        name: 'Draw Sword Combat Spin',
        description: 'hero draws steel in rain',
        motionNotes: 'hip to high',
        intention: 'threat'
      })
    )
    expect(a.visualTags).toBeTruthy()
    expect(a.name).toMatch(/Draw/)

    const fb = extractActionProfileJson('totally not json at all just prose')
    expect(fb.name).toBe('Untitled action')
    expect(fb.description).toMatch(/prose|totally/)
    expect(fb.hardRules).toBeTruthy()
  })
})
