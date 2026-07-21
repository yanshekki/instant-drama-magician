import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../test/handlerTestUtils'
import { registerSettingsHandlers } from './settings'

describe('registerSettingsHandlers', () => {
  it('registers settings channels', () => {
    const ctx = makeHandlerContext()
    registerSettingsHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('settings:get')).toBe(true)
    expect(handlers.has('settings:set')).toBe(true)
  })
})
