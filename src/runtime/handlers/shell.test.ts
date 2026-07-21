import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../test/handlerTestUtils'
import { registerShellHandlers } from './shell'

describe('registerShellHandlers', () => {
  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerShellHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('shell:openExternal')).toBe(true)
    expect(handlers.has('shell:openPath')).toBe(true)
    expect(handlers.has('shell:showItemInFolder')).toBe(true)
  })
})
