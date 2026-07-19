import { describe, expect, it, vi } from 'vitest'
import * as Mod from './LlmProviderPicker'

describe('LlmProviderPicker module', () => {
  it('exports at least one symbol', () => {
    const keys = Object.keys(Mod)
    expect(keys.length).toBeGreaterThan(0)
  })
})
