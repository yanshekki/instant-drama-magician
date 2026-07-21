import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../test/handlerTestUtils'
import { registerAdvancedprepHandlers } from './advancedPrep'

describe('registerAdvancedprepHandlers', () => {
  it('registers advanced prep channels', () => {
    const ctx = makeHandlerContext()
    registerAdvancedprepHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.size).toBeGreaterThan(0)
  })
})
