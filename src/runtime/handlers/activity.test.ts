import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../test/handlerTestUtils'
import { registerActivityHandlers } from './activity'

describe('registerActivityHandlers', () => {
  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerActivityHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('activity:recent')).toBe(true)
    expect(handlers.has('activity:query')).toBe(true)
    expect(handlers.has('activity:clear')).toBe(true)
  })
})
