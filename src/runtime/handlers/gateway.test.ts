import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../test/handlerTestUtils'
import { registerGatewayHandlers } from './gateway'

describe('registerGatewayHandlers', () => {
  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerGatewayHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('ai:probeVideo')).toBe(true)
    expect(handlers.has('ai:probeChat')).toBe(true)
    expect(handlers.has('ai:listModels')).toBe(true)
  })
})
