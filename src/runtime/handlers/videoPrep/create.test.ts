import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../../test/handlerTestUtils'
import { registerVideoPrepCreate } from './create'

describe('registerVideoPrepCreate', () => {
  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerVideoPrepCreate(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('videoPrep:create')).toBe(true)
  })
})
