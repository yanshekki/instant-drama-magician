import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../../test/handlerTestUtils'
import { registerCharactersSheet } from './sheet'

describe('registerCharactersSheet', () => {
  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerCharactersSheet(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('characters:generateSheet')).toBe(true)
    expect(handlers.has('characters:commitSheet')).toBe(true)
    expect(handlers.has('media:discardSheetDraft')).toBe(true)
  })
})
