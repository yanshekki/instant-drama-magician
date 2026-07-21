import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../../test/handlerTestUtils'
import { registerScenesIntroVideo } from './introVideo'

describe('registerScenesIntroVideo', () => {
  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerScenesIntroVideo(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('scenes:generateIntroVideo')).toBe(true)
  })
})
