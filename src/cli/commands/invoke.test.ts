import { describe, expect, it } from 'vitest'
import * as mod from './invoke'

describe('cmdInvoke module', () => {
  it('exports cmdInvoke', () => {
    expect(typeof mod.cmdInvoke).toBe('function')
  })
})
