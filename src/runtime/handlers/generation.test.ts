import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../test/handlerTestUtils'
import { registerGenerationHandlers } from './generation'

describe('registerGenerationHandlers', () => {
  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerGenerationHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('generation:run')).toBe(true)
    expect(handlers.has('generation:cancel')).toBe(true)
    expect(handlers.has('generation:progress')).toBe(true)
  })
})
