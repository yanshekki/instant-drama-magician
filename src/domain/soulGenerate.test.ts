import { describe, expect, it } from 'vitest'
import {
  buildSoulGenerateSystemPrompt,
  buildSoulGenerateUserPrompt,
  normalizeSoulMarkdown,
  profileHasSoulSource
} from './soulGenerate'

describe('soulGenerate', () => {
  it('builds prompts that mention structure and profile', () => {
    const sys = buildSoulGenerateSystemPrompt('zh-HK')
    expect(sys).toMatch(/soul\.md|Markdown/i)
    const user = buildSoulGenerateUserPrompt({
      profile: { name: '阿明', appearance: '短髮' },
      locale: 'zh-HK'
    })
    expect(user).toContain('阿明')
    expect(user).toContain('短髮')
  })

  it('en system prompt has structure headings', () => {
    const en = buildSoulGenerateSystemPrompt('en')
    expect(en).toMatch(/Identity|Appearance|Hard rules/)
  })

  it('normalizes fenced markdown variants', () => {
    expect(normalizeSoulMarkdown('```md\n# Hi\n```')).toBe('# Hi')
    expect(normalizeSoulMarkdown('```markdown\n# A\n```')).toBe('# A')
    expect(normalizeSoulMarkdown('```\n# B\n```')).toBe('# B')
    expect(normalizeSoulMarkdown('# Plain')).toBe('# Plain')
  })

  it('detects empty vs filled profile', () => {
    expect(profileHasSoulSource({})).toBe(false)
    expect(profileHasSoulSource({ name: 'X' })).toBe(true)
    expect(profileHasSoulSource({ description: 'd' })).toBe(true)
    expect(profileHasSoulSource({ appearance: 'a' })).toBe(true)
    expect(profileHasSoulSource({ personality: 'p' })).toBe(true)
    expect(profileHasSoulSource({ costume: 'c' })).toBe(true)
    expect(profileHasSoulSource({ backstory: 'b' })).toBe(true)
    expect(profileHasSoulSource({ name: '  ' })).toBe(false)
  })

  it('system prompt follows profile sources and invents when thin', () => {
    const zh = buildSoulGenerateSystemPrompt('zh-HK')
    const en = buildSoulGenerateSystemPrompt('en')
    expect(zh).toMatch(/Profile|表單|自由補齊/)
    expect(en).toMatch(/profile form|invent freely/i)
    expect(zh).not.toMatch(/雨夜|硬性禁止/)
  })

  it('includes story context when passed', () => {
    const u = buildSoulGenerateUserPrompt({
      profile: { name: '鋼琴老師' },
      locale: 'zh-HK',
      storyTitle: '校巴最後一站',
      styleNote: '午後金光'
    })
    expect(u).toContain('校巴最後一站')
    expect(u).toContain('午後金光')
  })

  it('improve mode merges existing soul and user request', () => {
    const u = buildSoulGenerateUserPrompt({
      profile: {
        name: 'Ming',
        description: 'courier',
        costume: 'rain jacket',
        personality: 'stubborn',
        backstory: 'night rides',
        ageRange: '20s',
        gender: 'm',
        voiceDesc: 'low',
        spokenLanguages: ['yue'],
        mannerisms: 'helmet',
        relationships: 'Yu',
        visualTags: 'urban'
      },
      locale: 'en',
      existingSoul: '# Ming\n## Identity\nCourier',
      userRequest: 'more vulnerability',
      storyTitle: 'Rain',
      styleNote: 'neon'
    })
    expect(u).toMatch(/IMPROVE MODE/)
    expect(u).toContain('Courier')
    expect(u).toContain('more vulnerability')
    expect(u).toContain('Rain')
    expect(u).toContain('neon')
  })

  it('truncates very long existing soul', () => {
    const long = 'x'.repeat(13_000)
    const u = buildSoulGenerateUserPrompt({
      profile: { name: 'A' },
      locale: 'zh-HK',
      existingSoul: long
    })
    expect(u).toMatch(/truncated|改進/)
    expect(u.length).toBeLessThan(long.length + 500)
  })
})
