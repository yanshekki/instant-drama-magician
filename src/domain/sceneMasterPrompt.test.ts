import { describe, expect, it } from 'vitest'
import {
  buildSceneIntroVideoPrompt,
  buildSceneMasterSystemPrompt,
  buildSceneMasterUserPrompt
} from './sceneMasterPrompt'

describe('sceneMasterPrompt', () => {
  it('system prompt uses provided sources; invents when thin', () => {
    const zh = buildSceneMasterSystemPrompt('zh-HK')
    const en = buildSceneMasterSystemPrompt('en')
    expect(zh).toMatch(/依據來源|自由補齊/)
    expect(en).toMatch(/Sources of truth|invent freely/i)
    expect(zh).not.toMatch(/硬性禁止雨夜/)
  })

  it('create mode with idea only does not invent extra cast when no story', () => {
    const u = buildSceneMasterUserPrompt({
      idea: '午後公園長椅',
      locale: 'zh-HK'
    })
    expect(u).toContain('午後公園長椅')
    expect(u).not.toContain('Demo')
    expect(u).not.toMatch(/可選製作上下文/)
  })

  it('buildSceneIntroVideoPrompt locks space and includes atmosphere', () => {
    const zh = buildSceneIntroVideoPrompt(
      {
        title: '碼頭倉庫',
        description: '鏽鐵門與濕潤碼頭',
        timeOfDay: 'night',
        weather: 'rain',
        mood: 'tense'
      },
      'zh-HK'
    )
    expect(zh).toMatch(/空間鎖定/)
    expect(zh).toContain('碼頭倉庫')
    expect(zh).toContain('rain')
    expect(zh).toContain('tense')

    const en = buildSceneIntroVideoPrompt(
      {
        title: 'Pier warehouse',
        description: 'Rust doors and wet pier',
        lighting: 'neon spill'
      },
      'en'
    )
    expect(en).toMatch(/SPACE LOCK/)
    expect(en).toContain('Pier warehouse')
    expect(en).toContain('neon spill')
  })
})
