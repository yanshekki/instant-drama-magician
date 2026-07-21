import { describe, expect, it } from 'vitest'
import {
  appendHardRules,
  collectTimelineHardRules,
  defaultHardRulesFallback,
  ensureHardRules,
  HARD_RULES_HEADER,
  hardRulesAiInstruction,
  hardRulesBlock,
  mergeHardRules,
  normalizeHardRules,
  stripHardRulesBlocks
} from './promptHardRules'

describe('normalizeHardRules', () => {
  it('trims and nulls empty', () => {
    expect(normalizeHardRules('  ')).toBeNull()
    expect(normalizeHardRules(null)).toBeNull()
    expect(normalizeHardRules('no extra limbs')).toBe('no extra limbs')
  })
})

describe('appendHardRules', () => {
  it('returns base when rules empty', () => {
    expect(appendHardRules('hello', '')).toBe('hello')
    expect(appendHardRules('hello', null)).toBe('hello')
  })

  it('appends highest-priority block', () => {
    const out = appendHardRules('draw a cup', '【禁止】電線')
    expect(out).toContain('draw a cup')
    expect(out).toContain(HARD_RULES_HEADER)
    expect(out).toContain('【禁止】電線')
    expect(out.indexOf('draw a cup')).toBeLessThan(out.indexOf(HARD_RULES_HEADER))
  })

  it('skips duplicate when already present', () => {
    const once = appendHardRules('base', 'two hands only')
    const twice = appendHardRules(once, 'two hands only')
    expect(twice).toBe(once)
  })
})

describe('ensureHardRules', () => {
  it('re-appends after user strips rules from override', () => {
    const full = appendHardRules('base prompt', 'no wires')
    const stripped = stripHardRulesBlocks(full)
    expect(stripped).not.toContain(HARD_RULES_HEADER)
    const fixed = ensureHardRules(stripped + ' user edit', 'no wires')
    expect(fixed).toContain('user edit')
    expect(fixed).toContain('no wires')
    expect(fixed).toContain(HARD_RULES_HEADER)
  })
})

describe('mergeHardRules', () => {
  it('dedupes lines', () => {
    const m = mergeHardRules('no wires\ntwo hands', 'two hands\nno third arm')
    expect(m).toContain('no wires')
    expect(m).toContain('two hands')
    expect(m).toContain('no third arm')
    expect(m!.split('\n').filter((l) => l === 'two hands').length).toBe(1)
  })
})

describe('hardRulesBlock', () => {
  it('includes header and footer', () => {
    const b = hardRulesBlock('must: two hands')
    expect(b.startsWith(HARD_RULES_HEADER)).toBe(true)
    expect(b).toContain('must: two hands')
  })
})

describe('hardRulesAiInstruction', () => {
  it('requires non-empty hardRules', () => {
    expect(hardRulesAiInstruction('en')).toMatch(/REQUIRED/i)
    expect(hardRulesAiInstruction('zh-HK')).toMatch(/必填/)
  })
})

describe('collectTimelineHardRules', () => {
  it('labels each object so rules stay attributable', () => {
    const m = collectTimelineHardRules({
      story: { hardRules: 'no watermark', title: 'Demo' },
      characters: [{ name: 'Keith', hardRules: 'two hands\nno third arm' }],
      scenes: [{ title: 'Roof', hardRules: 'empty set' }],
      props: [{ name: 'Umbrella', hardRules: 'no wires' }],
      actions: [{ name: 'Draw sword', hardRules: 'readable beats' }]
    })
    expect(m).toContain('[Story · Demo]')
    expect(m).toContain('[Character · Keith]')
    expect(m).toContain('[Scene · Roof]')
    expect(m).toContain('[Prop · Umbrella]')
    expect(m).toContain('[Action · Draw sword]')
    expect(m).toContain('two hands')
    expect(m).toContain('no wires')
  })

  it('can merge without labels (legacy dedupe)', () => {
    const m = collectTimelineHardRules(
      {
        story: { hardRules: 'no watermark\ntwo hands' },
        characters: [{ hardRules: 'two hands\nno third arm' }],
        props: [{ hardRules: 'no wires' }]
      },
      { labelObjects: false }
    )
    expect(m).toContain('no watermark')
    expect(m).toContain('two hands')
    expect(m).toContain('no third arm')
    expect(m).toContain('no wires')
    expect(m!.split('\n').filter((l) => l === 'two hands').length).toBe(1)
  })
})

describe('defaultHardRulesFallback', () => {
  it('returns non-empty for each kind', () => {
    for (const k of [
      'story',
      'character',
      'scene',
      'prop',
      'action',
      'costume'
    ] as const) {
      expect(defaultHardRulesFallback(k, 'zh-HK').length).toBeGreaterThan(10)
    }
  })
})
