import { describe, expect, it } from 'vitest'
import {
  collectTimelineHardRules,
  ensureHardRules
} from './promptHardRules'
import { mergeFinalVideoPrompt } from './videoPrep'
import { appendRevisionToClipPrompt } from './promptContinuity'

describe('hardRules path regressions', () => {
  it('confirm path re-seals after user strips HARD RULES from professional prompt', () => {
    const rules = collectTimelineHardRules({
      story: { title: 'Demo', hardRules: '【禁止】水印' },
      characters: [{ name: 'Keith', hardRules: '【必須】兩隻手' }]
    })
    expect(rules).toContain('[角色 · Keith]')
    const polished = '10s, 16:9. Man on rooftop walks forward.'
    const final = mergeFinalVideoPrompt(polished, 'slower camera', rules)
    expect(final).toContain('生成鐵則')
    expect(final).toContain('兩隻手')
    expect(final).toContain('水印')
    expect(final).toMatch(/導演修訂|DIRECTOR/)
  })

  it('revision cannot remove hard rules', () => {
    const base = ensureHardRules('clip base', 'no third arm')
    const revised = appendRevisionToClipPrompt(
      base.replace('生成鐵則', 'GONE'),
      'more drama',
      'no third arm'
    )
    expect(revised).toContain('生成鐵則')
    expect(revised).toContain('no third arm')
    expect(revised).toMatch(/REVISION|修訂|more drama/i)
  })
})
