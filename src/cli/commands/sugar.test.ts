import { describe, expect, it } from 'vitest'
import * as sugar from './sugar'

describe('cli sugar commands', () => {
  it('exports story/settings/ai/app handlers', () => {
    expect(typeof sugar.cmdStories).toBe('function')
    expect(typeof sugar.cmdSettings).toBe('function')
    expect(typeof sugar.cmdAi).toBe('function')
    expect(typeof sugar.cmdApp).toBe('function')
  })
})
