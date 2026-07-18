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

  it('normalizes fenced markdown', () => {
    expect(normalizeSoulMarkdown('```md\n# Hi\n```')).toBe('# Hi')
    expect(normalizeSoulMarkdown('# Plain')).toBe('# Plain')
  })

  it('detects empty vs filled profile', () => {
    expect(profileHasSoulSource({})).toBe(false)
    expect(profileHasSoulSource({ name: 'X' })).toBe(true)
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
})


