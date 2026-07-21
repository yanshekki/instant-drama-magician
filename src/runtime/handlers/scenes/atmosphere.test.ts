import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../../test/handlerTestUtils'
import { registerScenesAtmosphere } from './atmosphere'

describe('registerScenesAtmosphere', () => {
  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerScenesAtmosphere(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('scenes:swapAtmosphere')).toBe(true)
  })
})
