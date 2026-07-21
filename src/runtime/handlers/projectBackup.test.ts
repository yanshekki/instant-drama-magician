import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../test/handlerTestUtils'
import { registerProjectbackupHandlers } from './projectBackup'

describe('registerProjectbackupHandlers', () => {
  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerProjectbackupHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('project:exportBackup')).toBe(true)
    expect(handlers.has('project:importBackup')).toBe(true)
  })
})
