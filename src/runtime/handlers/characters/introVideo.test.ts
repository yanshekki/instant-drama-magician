import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../../test/handlerTestUtils'
import { registerCharactersIntroVideo } from './introVideo'

describe('registerCharactersIntroVideo', () => {
  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerCharactersIntroVideo(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('characters:generateIntroVideo')).toBe(true)
  })
})
