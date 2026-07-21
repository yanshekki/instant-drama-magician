import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../../test/handlerTestUtils'
import { registerCharactersSoul } from './soul'

describe('registerCharactersSoul', () => {
  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerCharactersSoul(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('characters:generateSoul')).toBe(true)
  })
})
