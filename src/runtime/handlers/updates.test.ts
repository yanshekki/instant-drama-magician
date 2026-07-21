import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../test/handlerTestUtils'
import { registerUpdatesHandlers } from './updates'

describe('registerUpdatesHandlers', () => {
  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerUpdatesHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('updates:status')).toBe(true)
    expect(handlers.has('updates:check')).toBe(true)
    expect(handlers.has('updates:download')).toBe(true)
  })
})
