import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../../test/handlerTestUtils'
import { registerScenesGallery } from './gallery'

describe('registerScenesGallery', () => {
  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerScenesGallery(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('scenes:copyGalleryFrom')).toBe(true)
  })
})
