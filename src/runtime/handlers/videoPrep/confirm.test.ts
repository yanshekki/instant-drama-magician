import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../../test/handlerTestUtils'
import { registerVideoPrepConfirm } from './confirm'

describe('registerVideoPrepConfirm', () => {
  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerVideoPrepConfirm(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('videoPrep:confirm')).toBe(true)
  })
})
