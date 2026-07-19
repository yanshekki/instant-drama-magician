import { describe, expect, it } from 'vitest'
import * as mod from './server'

describe('cmdServer module', () => {
  it('exports cmdServer', () => {
    expect(typeof mod.cmdServer).toBe('function')
  })
})
