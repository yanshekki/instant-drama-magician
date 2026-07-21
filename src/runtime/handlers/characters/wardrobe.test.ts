import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../../test/handlerTestUtils'
import { registerCharactersWardrobe } from './wardrobe'

describe('registerCharactersWardrobe', () => {
  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerCharactersWardrobe(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('characters:suggestWardrobe')).toBe(true)
  })
})
