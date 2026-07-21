import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../test/handlerTestUtils'
import { registerStorycastHandlers } from './storyCast'

describe('registerStorycastHandlers', () => {
  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerStorycastHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('stories:linkCharacter')).toBe(true)
    expect(handlers.has('stories:setCharacterCostume')).toBe(true)
    expect(handlers.has('stories:unlinkCharacter')).toBe(true)
  })
})
