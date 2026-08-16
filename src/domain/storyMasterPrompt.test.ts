import { describe, expect, it } from 'vitest'
import { AppError } from '../types/errors'
import {
  beatAiMaxBeats,
  beatAiMaxTokens,
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
    expect(m.hardRules).toBe('')
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
        sceneHints: [],
        propName: '傘',
        propNames: [],
        actionName: '',
        actionNames: [],
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

    const jaSys = buildStoryMetaSystemPrompt('ja')
    expect(jaSys).toMatch(/ショーランナー|短編/)
    expect(jaSys).not.toBe(enSys)
    const jaUser = buildStoryMetaUserPrompt({ title: '雨', locale: 'ja' })
    expect(jaUser).toMatch(/物語|構想|タイトル/)
    expect(jaUser).not.toMatch(/IMPROVE MODE/)
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
    const zh = buildStoryBeatsSystemPrompt('zh-HK', null, { maxBeats: 12 })
    expect(zh).toMatch(/劇情段落|units/)
    expect(zh).toMatch(/對白|SPEECH/)
    expect(zh).toMatch(/{{maxBeats}}|12/)
    expect(zh).not.toMatch(/固定寫 4 段/)
    expect(zh).toMatch(/sceneHints|propNames/)
    expect(zh).toMatch(/必須填 actionNames|唔好每樣只填一個/)
    const en = buildStoryBeatsSystemPrompt('en', null, { maxBeats: 12 })
    expect(en).toMatch(/TIMELINE BEATS|dialogue/)
    expect(en).toMatch(/SPEECH|spoken language/)
    expect(en).toMatch(/at most 12 beats/)
    expect(en).not.toMatch(/exactly 4 beats/)
    expect(en).toMatch(/sceneHints/)
    expect(en).toMatch(/actionNames is REQUIRED/)
    expect(en).toMatch(/Never leave actionNames empty/)
    expect(en).not.toMatch(/Do not dump the whole library/)
    expect(en).not.toMatch(/leave empty if none fit/)
    expect(zh).toMatch(/唔准留空|已選動作/)
    expect(zh).not.toMatch(/唔好每段 dump/)

    const userZh = buildStoryBeatsUserPrompt({
      title: '雨夜',
      styleNote: 'neon',
      idea: '重逢',
      characters: [{ name: '阿明', description: '鐵工' }],
      scenes: [{ sceneNumber: 1, description: '巷口' }],
      props: [{ name: '傘', description: '紅傘' }],
      actions: [{ name: '摘頭盔', motionNotes: 'slow' }],
      locale: 'zh-HK'
    })
    expect(userZh).toMatch(/阿明|巷口|傘|neon|重逢/)
    expect(userZh).toMatch(/摘頭盔/)

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
        sceneHints: [],
        propName: 'blade',
        propNames: [],
        actionName: '',
        actionNames: [],
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
        sceneHints: [],
        propName: '',
        propNames: [],
        actionName: '',
        actionNames: [],
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
        sceneHints: [],
        propName: 'silv',
        propNames: [],
        actionName: '',
        actionNames: [],
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
    expect(r.actionId).toBeNull()
    expect(r.actionIds).toEqual([])
  })

  it('clamps beat AI maxBeats and token budget', () => {
    expect(beatAiMaxBeats(undefined)).toBe(12)
    expect(beatAiMaxBeats(0)).toBe(12)
    expect(beatAiMaxBeats(1)).toBe(6)
    expect(beatAiMaxBeats(4)).toBe(12)
    expect(beatAiMaxBeats(8)).toBe(16)
    expect(beatAiMaxTokens(6)).toBe(1720)
    expect(beatAiMaxTokens(16)).toBe(3500)
  })

  it('extracts and resolves action names; dialogue-only does not bind the palette', () => {
    const beats = extractStoryBeatsJson(
      JSON.stringify([
        {
          characterName: 'Ming',
          sceneHint: '1',
          actionName: 'Sprint',
          actionNames: ['Bow'],
          dialogue: 'Go!'
        }
      ])
    )
    expect(beats[0].actionName).toBe('Sprint')
    expect(beats[0].actionNames).toEqual(['Sprint', 'Bow'])
    const hit = resolveBeatIds(beats[0], {
      characters: [{ id: 'c1', name: 'Ming' }],
      scenes: [{ id: 's1', sceneNumber: 1, description: 'roof' }],
      props: [],
      actions: [
        { id: 'a1', name: 'Sprint' },
        { id: 'a2', name: 'Deep Bow' }
      ]
    })
    expect(hit.actionId).toBe('a1')
    expect(hit.actionIds).toEqual(['a1', 'a2'])
    const miss = resolveBeatIds(
      {
        ...beats[0],
        actionName: '',
        actionNames: []
      },
      {
        characters: [],
        scenes: [],
        props: [],
        actions: [{ id: 'a1', name: 'Sprint' }]
      }
    )
    expect(miss.actionId).toBeNull()
    expect(miss.actionIds).toEqual([])
  })

  it('extracts plural scene/prop/action hints', () => {
    const beats = extractStoryBeatsJson(
      JSON.stringify([
        {
          characterNames: ['A', 'B'],
          sceneHint: 'Alley',
          sceneHints: ['Shrine'],
          propName: 'Talisman',
          propNames: ['Token'],
          actionNames: ['Descend', 'Bow'],
          units: [{ type: 'action', who: 'A', text: 'walks' }]
        }
      ])
    )
    expect(beats[0].sceneHints).toEqual(['Alley', 'Shrine'])
    expect(beats[0].propNames).toEqual(['Talisman', 'Token'])
    expect(beats[0].actionNames).toEqual(['Descend', 'Bow'])
  })

  it('resolveBeatIds binds multiple scenes/props and infers actions from unit text', () => {
    const r = resolveBeatIds(
      {
        characterName: '',
        characterNames: [],
        sceneHint: '巷口',
        sceneHints: ['祠堂'],
        propName: '',
        propNames: ['硃砂符紙', '令牌'],
        actionName: '',
        actionNames: [],
        dialogue: '',
        content: {
          version: 1,
          units: [
            { type: 'action', who: '沈執一', text: '獨自下山，停在祠堂前' }
          ]
        },
        scriptText: '獨自下山',
        beatContentJson: '{}'
      },
      {
        characters: [{ id: 'c1', name: '沈執一' }],
        scenes: [
          { id: 's1', sceneNumber: 1, title: '巷口', description: 'night alley' },
          { id: 's2', sceneNumber: 2, title: '祠堂', description: 'shrine' }
        ],
        props: [
          { id: 'p1', name: '硃砂符紙' },
          { id: 'p2', name: '令牌' }
        ],
        actions: [
          { id: 'a1', name: '獨自下山' },
          { id: 'a2', name: '誦咒捉鬼' }
        ]
      }
    )
    expect(r.sceneIds).toEqual(['s1', 's2'])
    expect(r.propIds).toEqual(['p1', 'p2'])
    expect(r.characterIds).toEqual(['c1'])
    expect(r.actionIds).toEqual(['a1'])
    expect(r.actionId).toBe('a1')
  })

  it('resolveBeatIds matches CJK action slices and uses the story palette on motion beats', () => {
    const paraphrased = resolveBeatIds(
      {
        characterName: '',
        characterNames: [],
        sceneHint: '',
        sceneHints: [],
        propName: '',
        propNames: [],
        actionName: '',
        actionNames: [],
        dialogue: '',
        content: {
          version: 1,
          units: [{ type: 'action', text: '沿石階走下山門，令牌握緊' }]
        },
        scriptText: '沿石階走下山門，令牌握緊',
        beatContentJson: '{}'
      },
      {
        characters: [],
        scenes: [],
        props: [],
        actions: [
          { id: 'a1', name: '獨自下山' },
          { id: 'a2', name: '握令牌趕路' }
        ]
      }
    )
    expect(paraphrased.actionIds).toEqual(['a1', 'a2'])
    const palette = resolveBeatIds(
      {
        characterName: '',
        characterNames: [],
        sceneHint: '',
        sceneHints: [],
        propName: '',
        propNames: [],
        actionName: '',
        actionNames: [],
        dialogue: '',
        content: {
          version: 1,
          units: [{ type: 'action', text: 'walks into frame' }]
        },
        scriptText: 'walks into frame',
        beatContentJson: '{}'
      },
      {
        characters: [],
        scenes: [],
        props: [],
        actions: [
          { id: 'a1', name: 'Sprint' },
          { id: 'a2', name: 'Bow' }
        ]
      }
    )
    expect(palette.actionIds).toEqual(['a1', 'a2'])
  })
})
