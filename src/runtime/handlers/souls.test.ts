import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../test/handlerTestUtils'
import { registerSoulsHandlers } from './souls'

describe('registerSoulsHandlers', () => {
  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerSoulsHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('souls:list')).toBe(true)
    expect(handlers.has('souls:get')).toBe(true)
    expect(handlers.has('souls:categories')).toBe(true)
  })
})
