import { describe, expect, it } from 'vitest'
import * as mod from './configCmd'

describe('cmdConfig module', () => {
  it('exports cmdConfig', () => {
    expect(typeof mod.cmdConfig).toBe('function')
  })
})
