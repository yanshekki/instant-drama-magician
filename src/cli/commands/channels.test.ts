import { describe, expect, it } from 'vitest'
import * as mod from './channels'

describe('cmdChannels module', () => {
  it('exports cmdChannels', () => {
    expect(typeof mod.cmdChannels).toBe('function')
  })
})
