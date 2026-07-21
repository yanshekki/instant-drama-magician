import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../test/handlerTestUtils'
import { registerWebserverHandlers } from './webServer'

describe('registerWebserverHandlers', () => {
  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerWebserverHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('webServer:status')).toBe(true)
    expect(handlers.has('webServer:start')).toBe(true)
    expect(handlers.has('webServer:stop')).toBe(true)
  })
})
