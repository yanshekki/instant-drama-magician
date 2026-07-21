import { describe, expect, it } from 'vitest'
import {
  buildSceneIntroVideoPrompt,
  buildSceneMasterSystemPrompt,
  buildSceneMasterUserPrompt,
  buildSceneSuggestFromStoryUserPrompt,
  extractSceneProfileJson
} from './sceneMasterPrompt'

describe('sceneMasterPrompt', () => {
  it('system prompt uses provided sources; invents when thin', () => {
    const zh = buildSceneMasterSystemPrompt('zh-HK')
    const en = buildSceneMasterSystemPrompt('en')
    expect(zh).toMatch(/依據來源|自由補齊/)
    expect(en).toMatch(/Sources of truth|invent freely/i)
    expect(zh).not.toMatch(/硬性禁止雨夜/)
  })

  it('system prompt requires all keys', () => {
    expect(buildSceneMasterSystemPrompt('zh-HK')).toMatch(/必須輸出|每一個鍵/)
  })

  it('extractSceneProfileJson coerces visualTags array', () => {
    const s = extractSceneProfileJson(
      JSON.stringify({
        title: 'Pier',
        description: 'Wet docks',
        script: 'A waits',
        locationType: 'exterior',
        visualTags: ['dock', 'rain', 'night']
      })
    )
    expect(s.title).toBe('Pier')
    expect(s.visualTags).toBe('dock, rain, night')
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

  it('user prompt improve mode with existing draft + story context', () => {
    const u = buildSceneMasterUserPrompt({
      idea: '更潮濕',
      locale: 'zh-HK',
      existingDraft: {
        title: '碼頭',
        description: '鏽鐵門',
        timeOfDay: 'night',
        weather: 'rain'
      },
      storyTitle: '雨夜',
      styleNote: 'neon'
    })
    expect(u).toMatch(/改進|IMPROVE|目前/i)
    expect(u).toContain('碼頭')
    expect(u).toContain('雨夜')
    expect(u).toContain('neon')
  })

  it('buildSceneSuggestFromStoryUserPrompt en/zh', () => {
    const zh = buildSceneSuggestFromStoryUserPrompt({
      locale: 'zh-HK',
      storyTitle: '雨夜',
      styleNote: 'neon',
      sceneNumber: 2,
      existingSceneTitles: ['巷口'],
      characterSnippets: ['阿明：外賣仔'],
      propSnippets: ['傘：紅傘'],
      priorSceneSnippets: ['#1 巷口：窄巷'],
      segmentLabel: '重逢',
      focusSnippets: ['阿明與小雨重逢']
    })
    expect(zh).toContain('雨夜')
    expect(zh).toContain('阿明')
    expect(zh).toMatch(/場景|2|neon/i)

    const en = buildSceneSuggestFromStoryUserPrompt({
      locale: 'en',
      storyTitle: 'Rain',
      sceneNumber: 1,
      characterSnippets: [],
      propSnippets: [],
      priorSceneSnippets: []
    })
    expect(en).toContain('Rain')
  })

  it('extractSceneProfileJson fenced and defaults', () => {
    const s = extractSceneProfileJson(
      '```json\n{"title":"Alley","description":"wet cobble","script":"A waits","locationType":"exterior","timeOfDay":"dusk","weather":"drizzle","mood":"lonely","lighting":"sodium","visualTags":"wet, neon","hardRules":"no logo"}\n```'
    )
    expect(s.title).toBe('Alley')
    expect(s.timeOfDay).toBe('dusk')
    expect(s.hardRules).toMatch(/logo/i)
  })
})
