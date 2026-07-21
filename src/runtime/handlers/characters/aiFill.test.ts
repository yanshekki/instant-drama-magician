import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../../test/handlerTestUtils'
import { registerCharactersAiFill } from './aiFill'

describe('registerCharactersAiFill', () => {
  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerCharactersAiFill(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('characters:aiFill')).toBe(true)
  })
})
