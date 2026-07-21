import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../test/handlerTestUtils'
import { registerMediaHandlers } from './media'

describe('registerMediaHandlers', () => {
  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerMediaHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('media:pickRefImage')).toBe(true)
    expect(handlers.has('media:exportStoryboard')).toBe(true)
    expect(handlers.has('media:exportConcat')).toBe(true)
  })
})
