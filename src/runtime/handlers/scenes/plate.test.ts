import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../../test/handlerTestUtils'
import { registerScenesPlate } from './plate'

describe('registerScenesPlate', () => {
  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerScenesPlate(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('scenes:generatePlate')).toBe(true)
    expect(handlers.has('scenes:commitPlate')).toBe(true)
  })
})
