import { describe, expect, it } from 'vitest'
import {
  buildCharacterIntroVideoPrompt,
  buildCharacterMasterSystemPrompt,
  buildCharacterMasterUserPrompt,
  buildCharacterSheetEditPrompt,
  buildCharacterSheetImagePrompt,
  characterVideoPromptBlock,
  extractCharacterProfileJson,
  resolveSheetGenMode
} from './characterMasterPrompt'

describe('characterMasterPrompt', () => {
  it('system prompt lists required keys', () => {
    const s = buildCharacterMasterSystemPrompt('zh-HK')
    expect(s).toContain('voiceDesc')
    expect(s).toContain('spokenLanguages')
    expect(s).toContain('mannerisms')
    expect(s).toContain('JSON')
  })

  it('user prompt merges full profile draft + soul in improve mode', () => {
    const u = buildCharacterMasterUserPrompt({
      idea: '令對白更適合粵語短劇',
      locale: 'zh-HK',
      existingDraft: {
        name: '阿明',
        appearance: '短髮',
        costume: '雨衣',
        spokenLanguages: ['yue']
      },
      soulContent: '# Soul\n\n固執外賣仔，夜雨送單。'
    })
    expect(u).toMatch(/改進模式|IMPROVE/)
    expect(u).toContain('阿明')
    expect(u).toContain('短髮')
    expect(u).toContain('雨衣')
    expect(u).toContain('固執外賣仔')
    expect(u).toContain('令對白更適合粵語短劇')
    expect(u).toMatch(/soul\.md|角色聖經/)
  })

  it('user prompt is create mode when only idea is given', () => {
    const u = buildCharacterMasterUserPrompt({
      idea: 'a black cat spirit',
      locale: 'en'
    })
    expect(u).toContain('Character idea:')
    expect(u).toContain('a black cat spirit')
    expect(u).not.toMatch(/IMPROVE MODE/)
  })

  it('system prompt uses provided sources and invents when thin', () => {
    const zh = buildCharacterMasterSystemPrompt('zh-HK')
    const en = buildCharacterMasterSystemPrompt('en')
    expect(zh).toMatch(/依據來源|用戶 idea/)
    expect(zh).toMatch(/自由補齊|空白/)
    expect(zh).not.toMatch(/硬性禁止|雨夜/)
    expect(en).toMatch(/Sources of truth|user idea/i)
    expect(en).toMatch(/invent freely/i)
    expect(en).not.toMatch(/HARD BAN|rainy night/i)
  })

  it('user prompt includes story context only when passed in', () => {
    const u = buildCharacterMasterUserPrompt({
      idea: '一位溫柔的鋼琴老師',
      locale: 'zh-HK',
      storyTitle: '校巴最後一站',
      styleNote: '午後金光'
    })
    expect(u).toContain('一位溫柔的鋼琴老師')
    expect(u).toContain('校巴最後一站')
    expect(u).toContain('午後金光')
    expect(u).toMatch(/一併提供|Additional context|風格備註|Style note/)
  })

  it('extracts JSON from fenced response', () => {
    const text = `Here you go:\n\`\`\`json\n{"name":"阿明","description":"外賣仔","appearance":"短髮","voiceDesc":"低沉","spokenLanguages":["yue","en"],"mannerisms":"摸頭盔"}\n\`\`\``
    const p = extractCharacterProfileJson(text)
    expect(p.name).toBe('阿明')
    expect(p.voiceDesc).toBe('低沉')
    expect(p.spokenLanguages).toEqual(['yue', 'en'])
    expect(p.mannerisms).toBe('摸頭盔')
  })

  it('coerces visualTags array to comma string', () => {
    const p = extractCharacterProfileJson(
      JSON.stringify({
        name: 'Ming',
        description: 'Courier',
        visualTags: ['helmet', 'delivery', 'urban']
      })
    )
    expect(p.visualTags).toBe('helmet, delivery, urban')
  })


  it('builds sheet image prompt with multi-view layout', () => {
    const p = buildCharacterSheetImagePrompt({
      name: 'Ming',
      appearance: 'short hair',
      costume: 'delivery jacket'
    })
    expect(p).toMatch(/front/i)
    expect(p).toMatch(/three-quarter|close-up|head-and-shoulders/i)
    expect(p).toContain('Ming')
    expect(p).toMatch(/IDENTITY LOCK|exactly one human/i)
    expect(p).toMatch(/THREE equal|EXACTLY THREE/i)
    expect(p).toMatch(/tack-sharp|micro-detail/i)
  })

  it('edit prompt forces restyle medium while locking identity', () => {
    const p = buildCharacterSheetEditPrompt(
      { name: 'Ming', appearance: 'short hair' },
      'bible',
      'anime_modern'
    )
    expect(p).toMatch(/LAYOUT CHANGE|IGNORE the source image LAYOUT/i)
    expect(p).toMatch(/MANDATORY MEDIUM|anime_modern/i)
    expect(p).toContain('Ming')
  })

  it('edit prompt for nude package strips source costume and forces new layout', () => {
    const p = buildCharacterSheetEditPrompt(
      { name: 'Ming', costume: 'red jacket' },
      'body_nude_turnaround',
      'photo_cinematic'
    )
    expect(p).toMatch(/STRIP all outer clothing|IGNORE.*costume/i)
    expect(p).toMatch(/body_nude_turnaround|FOUR full-body/i)
    expect(p).toMatch(/IGNORE the source image LAYOUT/i)
  })

  it('resolveSheetGenMode only edits when explicitly requested with ref', () => {
    expect(resolveSheetGenMode({ useIdentityEdit: false, hasValidRef: true })).toBe(
      'generate'
    )
    expect(resolveSheetGenMode({ useIdentityEdit: true, hasValidRef: false })).toBe(
      'generate'
    )
    expect(resolveSheetGenMode({ useIdentityEdit: true, hasValidRef: true })).toBe(
      'edit'
    )
    expect(resolveSheetGenMode({})).toBe('generate')
  })

  it('sheet image prompt for base layer skips outer costume wording path', () => {
    const p = buildCharacterSheetImagePrompt(
      {
        name: 'Ming',
        appearance: 'short hair',
        costume: 'delivery jacket',
        hardRules: '【禁止】水印'
      },
      'body_base_turnaround',
      'anime_modern'
    )
    expect(p).toMatch(/anime_modern|medium/i)
    expect(p).toContain('Ming')
    expect(p).toMatch(/禁止|水印/)
  })

  it('characterVideoPromptBlock and intro video prompts', () => {
    const block = characterVideoPromptBlock({
      name: 'Ming',
      ageRange: '20s',
      gender: 'm',
      appearance: 'short hair',
      costume: 'jacket',
      personality: 'stubborn',
      backstory: 'rides at night',
      relationships: 'knows Yu',
      mannerisms: 'touches helmet',
      voiceDesc: 'low',
      visualTags: 'urban',
      artStyle: 'photo_cinematic',
      spokenLanguages: ['yue', 'en']
    })
    expect(block).toContain('Ming')
    expect(block).toContain('short hair')
    expect(block).toContain('yue')

    const zh = buildCharacterIntroVideoPrompt(
      {
        name: '阿明',
        appearance: '短髮',
        personality: '固執',
        mannerisms: '摸頭盔',
        voiceDesc: '低沉',
        spokenLanguages: ['yue'],
        backstory: '夜雨送單',
        relationships: '與小雨有過往'
      },
      'zh-HK',
      { soulExcerpt: '## 身份\n外賣仔' }
    )
    expect(zh).toContain('阿明')
    expect(zh).toMatch(/身份|soul|外賣/i)

    const en = buildCharacterIntroVideoPrompt(
      { name: 'Ming', description: 'courier' },
      'en'
    )
    expect(en).toContain('Ming')
    expect(en).toMatch(/intro|self|character/i)

    const zhDefaults = buildCharacterIntroVideoPrompt(
      { name: '阿明' },
      'zh-HK'
    )
    expect(zhDefaults).toMatch(/跟從角色人設|溫暖清晰|自然微動作|清晰聲線/)
  })

  it('extractCharacterProfileJson rejects empty / invalid', () => {
    expect(() => extractCharacterProfileJson('no json here')).toThrow()
    expect(() =>
      extractCharacterProfileJson(JSON.stringify({ description: 'only' }))
    ).toThrow()
  })
})
