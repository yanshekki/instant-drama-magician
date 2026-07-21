import { describe, expect, it } from 'vitest'
import { AppError } from '../types/errors'
import {
  buildStoryBeatsSystemPrompt,
  buildStoryBeatsUserPrompt,
  buildStoryMetaSystemPrompt,
  buildStoryMetaUserPrompt,
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

  it('builds meta system/user prompts for zh and en', () => {
    const zhSys = buildStoryMetaSystemPrompt('zh-HK')
    expect(zhSys).toMatch(/短劇|風格/)
    const enSys = buildStoryMetaSystemPrompt('en')
    expect(enSys).toMatch(/showrunner|style bible/i)

    const zhUser = buildStoryMetaUserPrompt({
      title: '雨夜',
      idea: '重逢',
      existingStyleNote: 'neon',
      existingHardRules: 'no logo',
      contextSnippets: ['阿明：鐵工', '', '場景：巷'],
      locale: 'zh-HK'
    })
    expect(zhUser).toMatch(/雨夜|重逢|neon|no logo|鐵工/)

    const enUser = buildStoryMetaUserPrompt({
      title: 'Rain',
      locale: 'en'
    })
    expect(enUser).toMatch(/Rain|styleNote|hardRules/i)
  })

  it('extracts meta from fenced json and rejects empty styleNote', () => {
    const m = extractStoryMetaJson(
      '```json\n{"styleNote":"  fog  ","hardRules":"must: wet asphalt"}\n```',
      'en'
    )
    expect(m.styleNote).toBe('fog')
    expect(m.hardRules.length).toBeGreaterThan(0)

    expect(() => extractStoryMetaJson('{"styleNote":""}')).toThrow(AppError)
    expect(() => extractStoryMetaJson('{"styleNote":"  "}')).toThrow(AppError)
  })

  it('builds beats system/user prompts', () => {
    const zh = buildStoryBeatsSystemPrompt('zh-HK')
    expect(zh).toMatch(/劇情段落|units/)
    const en = buildStoryBeatsSystemPrompt('en')
    expect(en).toMatch(/TIMELINE BEATS|dialogue/)

    const userZh = buildStoryBeatsUserPrompt({
      title: '雨夜',
      styleNote: 'neon',
      idea: '重逢',
      characters: [{ name: '阿明', description: '鐵工' }],
      scenes: [{ sceneNumber: 1, description: '巷口' }],
      props: [{ name: '傘', description: '紅傘' }],
      locale: 'zh-HK'
    })
    expect(userZh).toMatch(/阿明|巷口|傘|neon|重逢/)

    const userEnEmpty = buildStoryBeatsUserPrompt({
      title: 'Rain',
      characters: [],
      scenes: [],
      props: [],
      locale: 'en'
    })
    expect(userEnEmpty).toMatch(/no cast|no scenes|none/i)
  })

  it('extracts beats from fenced array and sceneNumber hint', () => {
    const beats = extractStoryBeatsJson(
      '```json\n[{"characterName":"Ming","sceneNumber":3,"propName":"Key","dialogue":"Open it."}]\n```',
      'en'
    )
    expect(beats).toHaveLength(1)
    expect(beats[0].sceneHint).toBe('3')
    expect(beats[0].dialogue).toMatch(/Open/)

    expect(() => extractStoryBeatsJson('{"not":"array"}')).toThrow(AppError)
    expect(() => extractStoryBeatsJson('[]')).toThrow(AppError)
    expect(() =>
      extractStoryBeatsJson('[{"characterName":"x"}]')
    ).toThrow(AppError)
  })

  it('resolveBeatIds matches title/description and partial names', () => {
    const r = resolveBeatIds(
      {
        characterName: '',
        characterNames: ['Mei'],
        sceneHint: 'rooftop',
        propName: 'blade',
        dialogue: 'hi',
        content: {
          version: 1,
          units: [{ type: 'dialogue', who: 'Mei', line: 'hi' }]
        },
        scriptText: 'hi',
        beatContentJson: '{}'
      },
      {
        characters: [
          { id: 'c1', name: 'Xiao Mei' },
          { id: 'c2', name: 'Other' }
        ],
        scenes: [
          {
            id: 's1',
            sceneNumber: 1,
            title: 'Rooftop rain',
            description: 'city roof'
          }
        ],
        props: [{ id: 'p1', name: 'Silver Blade' }]
      }
    )
    expect(r.characterId).toBe('c1')
    expect(r.sceneId).toBe('s1')
    expect(r.propId).toBe('p1')
  })

  it('resolveBeatIds falls back to first scene when hint empty', () => {
    const r = resolveBeatIds(
      {
        characterName: '',
        characterNames: [],
        sceneHint: '',
        propName: '',
        dialogue: 'x',
        content: { version: 1, units: [{ type: 'action', text: 'walks' }] },
        scriptText: 'walks',
        beatContentJson: '{}'
      },
      {
        characters: [],
        scenes: [{ id: 's0', description: 'default' }],
        props: []
      }
    )
    expect(r.sceneId).toBe('s0')
    expect(r.characterId).toBeNull()
    expect(r.propId).toBeNull()
  })

  it('beats user prompt empty lists and style/idea optional', () => {
    const en = buildStoryBeatsUserPrompt({
      title: 'T',
      styleNote: '  neon  ',
      idea: '  conflict  ',
      characters: [{ name: 'A', description: 'd'.repeat(200) }],
      scenes: [{ title: 'Roof', description: 'city' }],
      props: [{ name: 'Key' }],
      locale: 'en'
    })
    expect(en).toMatch(/neon|conflict|Style:|User direction|Cast|Roof/i)

    const zhThin = buildStoryBeatsUserPrompt({
      title: '薄',
      characters: [],
      scenes: [],
      props: [],
      locale: 'zh-HK'
    })
    expect(zhThin).toMatch(/無角色|無場景|無/)
  })

  it('extractStoryBeatsJson legacy script field and characterNames from units', () => {
    const beats = extractStoryBeatsJson(
      JSON.stringify([
        {
          characterName: 'Ming',
          characterNames: ['Yu'],
          sceneHint: 'rooftop rain',
          propName: 'umbrella',
          script: 'Ming runs through rain and calls Yu'
        }
      ]),
      'en'
    )
    expect(beats[0].characterNames).toContain('Ming')
    expect(beats[0].content.units.length).toBeGreaterThan(0)

    const shortSpeech = extractStoryBeatsJson(
      '[{"characterName":"A","dialogue":"Go now!"}]'
    )
    expect(shortSpeech[0].content.units[0]?.type).toBe('dialogue')
  })

  it('resolveBeatIds partial prop match and no scenes', () => {
    const r = resolveBeatIds(
      {
        characterName: 'Xiao',
        characterNames: [],
        sceneHint: '',
        propName: 'silv',
        dialogue: 'hi',
        content: {
          version: 1,
          units: [{ type: 'dialogue', who: 'Xiao', line: 'hi' }]
        },
        scriptText: 'hi',
        beatContentJson: '{}'
      },
      {
        characters: [{ id: 'c1', name: 'Xiao Mei' }],
        scenes: [],
        props: [{ id: 'p1', name: 'Silver key' }]
      }
    )
    expect(r.characterId).toBe('c1')
    expect(r.propId).toBe('p1')
    expect(r.sceneId).toBeNull()
  })
})
