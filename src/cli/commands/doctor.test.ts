import { describe, expect, it } from 'vitest'
import * as mod from './doctor'

describe('cmdDoctor module', () => {
  it('exports cmdDoctor', () => {
    expect(typeof mod.cmdDoctor).toBe('function')
  })
})
