import { describe, expect, it } from 'vitest'
import {
  extractStoryBeatsJson,
  extractStoryMetaJson,
  extractStyleNoteJson,
  resolveBeatIds
} from './storyMasterPrompt'

describe('storyMasterPrompt', () => {
  it('extracts styleNote', () => {
    expect(
      extractStyleNoteJson('{"styleNote":" neon rain, handheld "}')
    ).toBe('neon rain, handheld')
  })

  it('extracts styleNote + hardRules', () => {
    const m = extractStoryMetaJson(
      '{"styleNote":" neon rain ","hardRules":"【禁止】水印\\n【必須】可讀剪影"}'
    )
    expect(m.styleNote).toBe('neon rain')
    expect(m.hardRules).toMatch(/水印|剪影/)
  })

  it('falls back hardRules when omitted', () => {
    const m = extractStoryMetaJson('{"styleNote":"mood only"}', 'en')
    expect(m.styleNote).toBe('mood only')
    expect(m.hardRules.length).toBeGreaterThan(5)
  })

  it('extracts beats array (legacy dialogue)', () => {
    const beats = extractStoryBeatsJson(
      '[{"characterName":"Ming","sceneHint":"1","propName":"","dialogue":"Go!"}]'
    )
    expect(beats).toHaveLength(1)
    expect(beats[0].dialogue).toMatch(/Go!/)
    expect(beats[0].beatContentJson).toBeTruthy()
  })

  it('extracts full multi-unit beat content', () => {
    const beats = extractStoryBeatsJson(
      JSON.stringify([
        {
          characterName: '阿明',
          sceneHint: '1',
          propName: '',
          mood: '緊繃',
          atmosphere: '雨',
          units: [
            { type: 'action', who: '阿明', text: '摘頭盔' },
            { type: 'dialogue', who: '阿明', line: '又係落雨……', tone: '低聲' },
            { type: 'dialogue', who: '阿明', line: '你仲喺度？' }
          ]
        }
      ]),
      'zh-HK'
    )
    expect(beats[0].content.units.filter((u) => u.type === 'dialogue')).toHaveLength(
      2
    )
    expect(beats[0].dialogue).toMatch(/又係落雨/)
    expect(beats[0].dialogue).not.toMatch(/摘頭盔/)
  })

  it('resolves cast ids by name / scene number', () => {
    const r = resolveBeatIds(
      {
        characterName: '阿明',
        characterNames: ['阿明'],
        sceneHint: '2',
        propName: '傘',
        dialogue: '走',
        content: { version: 1, units: [{ type: 'dialogue', who: '阿明', line: '走' }] },
        scriptText: '【對白｜阿明】走',
        beatContentJson: '{}'
      },
      {
        characters: [
          { id: 'c1', name: '阿明' },
          { id: 'c2', name: '阿美' }
        ],
        scenes: [
          { id: 's1', sceneNumber: 1, description: '街' },
          { id: 's2', sceneNumber: 2, description: '店' }
        ],
        props: [{ id: 'p1', name: '雨傘' }]
      }
    )
    expect(r.characterId).toBe('c1')
    expect(r.sceneId).toBe('s2')
    expect(r.propId).toBe('p1')
    expect(r.characterIds).toContain('c1')
    expect(r.durationSeconds).toBeGreaterThanOrEqual(4)
  })
})
