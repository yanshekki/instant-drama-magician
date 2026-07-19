import { describe, expect, it } from 'vitest'
import * as mod from './prepareVideoPrompt'

describe('prepareVideoPrompt', () => {
  it('exports callable helpers', () => {
    const fns = Object.values(mod).filter((v) => typeof v === 'function')
    expect(fns.length).toBeGreaterThan(0)
  })
})
