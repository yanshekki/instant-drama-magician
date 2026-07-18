import { describe, expect, it } from 'vitest'
import {
  beatContentToClipPromptBlock,
  commitBeatScriptEdit,
  estimateBeatDurationSeconds,
  extractSpokenLines,
  legacyDialogueToBeatContent,
  parseBeatContent,
  serializeBeatContent
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
})
