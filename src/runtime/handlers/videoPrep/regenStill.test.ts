import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../../test/handlerTestUtils'
import { registerVideoPrepRegenStill } from './regenStill'

describe('registerVideoPrepRegenStill', () => {
  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerVideoPrepRegenStill(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('videoPrep:regenStill')).toBe(true)
  })
})
