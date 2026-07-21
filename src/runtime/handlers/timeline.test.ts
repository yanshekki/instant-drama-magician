import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../test/handlerTestUtils'
import { registerTimelineHandlers } from './timeline'

describe('registerTimelineHandlers', () => {
  it('registers timeline channels', () => {
    const ctx = makeHandlerContext()
    registerTimelineHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('timeline:list')).toBe(true)
    expect(handlers.has('timeline:create')).toBe(true)
    expect(handlers.has('timeline:update')).toBe(true)
  })
})
