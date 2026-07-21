import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../test/handlerTestUtils'
import { registerStoriesHandlers } from './stories'

describe('registerStoriesHandlers', () => {
  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerStoriesHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('stories:list')).toBe(true)
    expect(handlers.has('stories:get')).toBe(true)
    expect(handlers.has('stories:create')).toBe(true)
  })
})
