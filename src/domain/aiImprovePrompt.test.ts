import { describe, expect, it } from 'vitest'
import {
  buildImproveUserPrompt,
  compactDraft,
  draftHasContent,
  truncateForPrompt
} from './aiImprovePrompt'

describe('aiImprovePrompt', () => {
  it('detects non-empty drafts', () => {
    expect(draftHasContent({ a: '', b: 'x' })).toBe(true)
    expect(draftHasContent({ a: '', b: [] })).toBe(false)
    expect(draftHasContent(null)).toBe(false)
  })

  it('compacts empty fields', () => {
    expect(compactDraft({ a: '  hi ', b: '', c: ['yue'] })).toEqual({
      a: 'hi',
      c: ['yue']
    })
  })

  it('builds improve mode when draft present', () => {
    const p = buildImproveUserPrompt({
      locale: 'zh-HK',
      idea: '加強夜雨氣氛',
      draft: { name: '阿明', appearance: '短髮' },
      extraBlocks: [
        { labelEn: 'soul', labelZh: 'soul', body: '固執外賣仔' }
      ]
    })
    expect(p).toMatch(/改進模式|IMPROVE/)
    expect(p).toContain('阿明')
    expect(p).toContain('固執外賣仔')
    expect(p).toContain('加強夜雨氣氛')
  })

  it('builds create mode when empty', () => {
    const p = buildImproveUserPrompt({
      locale: 'en',
      idea: 'a black cat',
      createLabel: { en: 'Idea:', zh: '構想：' }
    })
    expect(p).toContain('Idea:')
    expect(p).toContain('a black cat')
    expect(p).not.toMatch(/IMPROVE MODE/)
  })

  it('includes provided story/style as additional context', () => {
    const p = buildImproveUserPrompt({
      locale: 'zh-HK',
      idea: '鋼琴老師',
      storyTitle: '校巴最後一站',
      styleNote: '午後金光'
    })
    expect(p).toMatch(/一併提供|Additional context/)
    expect(p).toContain('鋼琴老師')
    expect(p).toContain('校巴最後一站')
    expect(p).toContain('午後金光')
  })

  it('truncateForPrompt and draftHasContent edge cases', () => {
    expect(truncateForPrompt('short')).toBe('short')
    expect(truncateForPrompt('x'.repeat(20), 10)).toMatch(/truncated/)
    expect(draftHasContent({ n: 0 })).toBe(true)
    expect(draftHasContent({ o: { a: 1 } })).toBe(true)
    expect(draftHasContent({ n: null })).toBe(false)
    expect(compactDraft({ a: '', b: null as unknown as string, c: 1 })).toEqual(
      { c: 1 }
    )
  })

  it('improve mode empty idea polish and custom closing', () => {
    const p = buildImproveUserPrompt({
      locale: 'en',
      idea: '',
      draft: { name: 'A' },
      emptyIdeaPolish: { en: '(polish me)', zh: '（潤飾）' },
      closing: { en: 'Return JSON only.', zh: '只回 JSON' }
    })
    expect(p).toContain('(polish me)')
    expect(p).toContain('Return JSON only.')
  })

  it('create mode with idea and closing', () => {
    const p = buildImproveUserPrompt({
      locale: 'en',
      idea: 'cat spirit',
      createLabel: { en: 'Idea:', zh: '構想：' },
      closing: { en: 'Return JSON only.', zh: '只回 JSON' }
    })
    expect(p).toContain('Idea:')
    expect(p).toContain('cat spirit')
    expect(p).toContain('Return JSON only.')
  })

  it('filters empty extra blocks', () => {
    const p = buildImproveUserPrompt({
      locale: 'en',
      idea: 'x',
      draft: { name: 'A' },
      extraBlocks: [
        { labelEn: 'soul', labelZh: 'soul', body: '  ' },
        { labelEn: 'ok', labelZh: 'ok', body: 'keep' }
      ]
    })
    expect(p).toContain('keep')
    expect(p).not.toMatch(/\bsoul\b/)
  })
})

