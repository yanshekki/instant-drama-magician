import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../test/handlerTestUtils'
import { registerCostumesHandlers } from './costumes'

describe('registerCostumesHandlers', () => {
  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerCostumesHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('costumes:list')).toBe(true)
    expect(handlers.has('costumes:get')).toBe(true)
    expect(handlers.has('costumes:create')).toBe(true)
  })
})
