import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../test/handlerTestUtils'
import { registerActionsHandlers } from './actions'

describe('registerActionsHandlers', () => {
  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerActionsHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('actions:list')).toBe(true)
    expect(handlers.has('actions:create')).toBe(true)
    expect(handlers.has('actions:update')).toBe(true)
  })
})
