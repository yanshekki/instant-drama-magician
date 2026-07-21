import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../../test/handlerTestUtils'
import { registerCharactersCostumeSwap } from './costumeSwap'

describe('registerCharactersCostumeSwap', () => {
  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerCharactersCostumeSwap(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('characters:swapCostume')).toBe(true)
  })
})
