import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../../test/handlerTestUtils'
import { registerScenesAiFill } from './aiFill'

describe('registerScenesAiFill', () => {
  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerScenesAiFill(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('scenes:aiFill')).toBe(true)
  })
})
