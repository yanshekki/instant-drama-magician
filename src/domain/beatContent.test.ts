import { describe, expect, it } from 'vitest'
import {
  beatContentForEditor,
  beatContentToClipPromptBlock,
  beatContentToJson,
  beatScriptTemplate,
  commitBeatScriptEdit,
  emptyBeatContent,
  estimateBeatDurationSeconds,
  extractSpokenLines,
  isBeatContent,
  legacyDialogueToBeatContent,
  normalizeBeatContent,
  parseBeatContent,
  serializeBeatContent,
  spokenSummaryFromBeatContent
} from './beatContent'

describe('beatContent', () => {
  it('parses multi-line canonical zh script with multiple dialogues', () => {
    const text = [
      '【心情】緊繃',
      '【氣氛】門縫暖光',
      '【動作｜阿明】摘下安全帽',
      '【表情｜阿明】眉心緊鎖',
      '【對白｜阿明｜低聲】又係落雨……',
      '【對白｜阿明】你……仲喺度？'
    ].join('\n')
    const c = parseBeatContent(text)
    expect(c?.mood).toBe('緊繃')
    expect(c?.atmosphere).toBe('門縫暖光')
    expect(c?.units.filter((u) => u.type === 'dialogue')).toHaveLength(2)
    expect(extractSpokenLines(c!)).toContain('又係落雨')
    expect(extractSpokenLines(c!)).toContain('仲喺度')
    expect(extractSpokenLines(c!)).not.toContain('安全帽')
  })

  it('legacy narrative becomes action not speech', () => {
    const c = legacyDialogueToBeatContent(
      '阿明摘下安全帽，雨水順著帽簷砸地。他盯著門縫暖光。'
    )
    expect(c?.units[0]?.type).toBe('action')
    expect(extractSpokenLines(c!)).toBe('')
  })

  it('clip prompt separates SPEECH and VISUAL ACTION', () => {
    const c = parseBeatContent(
      [
        '【動作｜阿明】摘頭盔',
        '【對白｜阿明】又係落雨……'
      ].join('\n')
    )
    const block = beatContentToClipPromptBlock(c)
    expect(block).toMatch(/VISUAL ACTION/)
    expect(block).toMatch(/SPEECH/)
    expect(block).toMatch(/又係落雨/)
  })

  it('commitBeatScriptEdit stores json + spoken cache', () => {
    const r = commitBeatScriptEdit(
      ['【動作｜阿明】摘帽', '【對白｜阿明】你好'].join('\n')
    )
    expect(r.beatContentJson).toMatch(/"version":1/)
    expect(r.dialogue).toMatch(/你好/)
    expect(r.dialogue).not.toMatch(/摘帽/)
  })

  it('duration grows with dialogue lines', () => {
    const short = parseBeatContent('【對白｜A】嗨')
    const long = parseBeatContent(
      [
        '【對白｜A】第一句比較長一點的話',
        '【對白｜B】第二句也有內容',
        '【對白｜A】第三句繼續'
      ].join('\n')
    )
    expect(estimateBeatDurationSeconds(long)).toBeGreaterThan(
      estimateBeatDurationSeconds(short)
    )
  })

  it('serialize round-trips', () => {
    const text = [
      '【心情】猶豫',
      '【對白｜小雨｜輕聲】你仲記得呢條路。'
    ].join('\n')
    const c = parseBeatContent(text)!
    const again = parseBeatContent(serializeBeatContent(c, 'zh-HK'))
    expect(again?.mood).toBe('猶豫')
    expect(extractSpokenLines(again!)).toMatch(/呢條路/)
  })

  it('empty / isBeatContent / normalize edge cases', () => {
    expect(emptyBeatContent()).toEqual({ version: 1, units: [] })
    expect(isBeatContent({ version: 1, units: [] })).toBe(true)
    expect(isBeatContent(null)).toBe(false)
    expect(isBeatContent({ version: 2, units: [] })).toBe(false)
    expect(isBeatContent({ version: 1 })).toBe(false)

    expect(normalizeBeatContent(null)).toBeNull()
    expect(normalizeBeatContent({ units: [] })).toBeNull()
    const n = normalizeBeatContent({
      mood: ' tense ',
      atmosphere: ' rain ',
      camera: ' handheld ',
      sfx: ' drip ',
      units: [
        null,
        { type: 'action', text: '  walks  ', who: '  A  ' },
        { type: 'expression', text: 'frown' },
        { type: 'dialogue', who: 'A', line: 'hi', tone: 'soft', parenthetical: 'whisper' },
        { type: 'dialogue', text: 'from text field' },
        { type: 'note', text: 'beat note' },
        { type: 'action', text: '' },
        { type: 'unknown', text: 'x' }
      ]
    })
    expect(n?.mood).toBe('tense')
    expect(n?.units.filter((u) => u.type === 'dialogue')).toHaveLength(2)
    expect(n?.units.some((u) => u.type === 'note')).toBe(true)
  })

  it('legacy spoken-like and structured en tags', () => {
    const spoken = legacyDialogueToBeatContent('阿明：走吧')
    expect(spoken?.units[0]?.type).toBe('dialogue')

    const quoted = legacyDialogueToBeatContent('「快點」')
    expect(quoted?.units[0]?.type).toBe('dialogue')

    const en = parseBeatContent(
      [
        '[MOOD] tense',
        '[ATMO] rain',
        '[CAMERA] OTS',
        '[SFX] thunder',
        '[ACTION|Ming] removes helmet',
        '[EXPR|Ming] clenched jaw',
        '[DIALOGUE|Ming|soft] Hello again',
        'untagged note line'
      ].join('\n')
    )
    expect(en?.mood).toBe('tense')
    expect(en?.atmosphere).toBe('rain')
    expect(en?.camera).toBe('OTS')
    expect(en?.sfx).toBe('thunder')
    expect(en?.units.some((u) => u.type === 'action')).toBe(true)
    expect(en?.units.some((u) => u.type === 'expression')).toBe(true)
    expect(en?.units.some((u) => u.type === 'dialogue')).toBe(true)
    expect(en?.units.some((u) => u.type === 'note')).toBe(true)
  })

  it('parseBeatContent uses json fallback and parenthetical dialogue', () => {
    const fromJson = parseBeatContent(
      null,
      JSON.stringify({
        version: 1,
        mood: 'calm',
        units: [{ type: 'dialogue', who: 'A', line: 'ok' }]
      })
    )
    expect(fromJson?.mood).toBe('calm')

    const paren = parseBeatContent(
      '【對白｜阿明｜低聲】（自語）還在嗎？'
    )
    const d = paren?.units.find((u) => u.type === 'dialogue')
    expect(d && d.type === 'dialogue' && d.parenthetical).toBeTruthy()

    const asJsonObj = parseBeatContent(
      JSON.stringify({
        version: 1,
        units: [{ type: 'action', text: 'runs' }]
      })
    )
    expect(asJsonObj?.units[0]?.type).toBe('action')

    expect(parseBeatContent(null)).toBeNull()
    expect(parseBeatContent('plain free text narrative without tags')).toBeTruthy()
  })

  it('serialize en + json + editor + clip + duration + template', () => {
    const c = normalizeBeatContent({
      mood: 'm',
      atmosphere: 'a',
      camera: 'c',
      sfx: 's',
      units: [
        { type: 'action', who: 'A', text: 'walks' },
        { type: 'expression', who: 'A', text: 'smiles' },
        {
          type: 'dialogue',
          who: 'A',
          line: 'hi',
          tone: 'soft',
          parenthetical: 'aside'
        },
        { type: 'note', text: 'note' }
      ]
    })!
    const en = serializeBeatContent(c, 'en')
    expect(en).toMatch(/\[MOOD\]/)
    expect(en).toMatch(/\[DIALOGUE/)
    expect(beatContentToJson(c)).toContain('"version":1')
    expect(spokenSummaryFromBeatContent(c)).toMatch(/hi/)
    expect(
      beatContentForEditor(serializeBeatContent(c, 'en'), null, 'en')
    ).toMatch(/\[MOOD\]/)
    expect(beatContentForEditor(null, beatContentToJson(c), 'en')).toMatch(
      /\[MOOD\]|hi/
    )
    expect(beatContentForEditor('legacy free text only', null, 'zh-HK')).toBe(
      'legacy free text only'
    )
    expect(beatContentForEditor(null, null, 'zh-HK')).toBe('')

    const block = beatContentToClipPromptBlock(c)
    expect(block).toMatch(/SPEECH|VISUAL|MOOD|CAMERA/i)
    expect(beatContentToClipPromptBlock(null, 'just dialogue')).toBeTruthy()
    expect(beatContentToClipPromptBlock(null, null)).toBeNull()

    expect(estimateBeatDurationSeconds(null)).toBeGreaterThan(0)
    expect(estimateBeatDurationSeconds(emptyBeatContent())).toBeGreaterThan(0)
    expect(beatScriptTemplate('en')).toMatch(/MOOD|DIALOGUE/)
    expect(beatScriptTemplate('zh-HK')).toMatch(/心情|對白/)

    const emptyCommit = commitBeatScriptEdit('   ')
    expect(emptyCommit.beatContentJson).toBeNull()
    expect(emptyCommit.dialogue).toBeNull()
  })
})
