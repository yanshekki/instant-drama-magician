import { describe, expect, it } from 'vitest'
import {
  collectTimelineHardRules,
  ensureHardRules,
  HARD_RULES_HEADER
} from './promptHardRules'
import { mergeFinalVideoPrompt } from './videoPrep'
import { appendRevisionToClipPrompt } from './promptContinuity'

describe('hardRules path regressions', () => {
  it('confirm path re-seals after user strips HARD RULES from professional prompt', () => {
    const rules = collectTimelineHardRules({
      story: { title: 'Demo', hardRules: '【禁止】水印' },
      characters: [{ name: 'Keith', hardRules: '【必須】兩隻手' }]
    })
    expect(rules).toContain('[Character · Keith]')
    const polished = '10s, 16:9. Man on rooftop walks forward.'
    const final = mergeFinalVideoPrompt(polished, 'slower camera', rules)
    expect(final).toContain(HARD_RULES_HEADER)
    expect(final).toContain('兩隻手')
    expect(final).toContain('水印')
    expect(final).toContain('DIRECTOR / USER REVISION')
  })

  it('revision cannot remove hard rules', () => {
    const base = ensureHardRules('clip base', 'no third arm')
    const revised = appendRevisionToClipPrompt(
      base.replace(HARD_RULES_HEADER, 'GONE'),
      'more drama',
      'no third arm'
    )
    expect(revised).toContain(HARD_RULES_HEADER)
    expect(revised).toContain('no third arm')
    expect(revised).toMatch(/REVISION|修訂|more drama/i)
  })
})
