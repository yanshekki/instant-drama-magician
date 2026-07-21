import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../test/handlerTestUtils'
import { registerPropsHandlers } from './props'

describe('registerPropsHandlers', () => {
  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerPropsHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('props:list')).toBe(true)
    expect(handlers.has('props:create')).toBe(true)
    expect(handlers.has('props:update')).toBe(true)
  })
})
