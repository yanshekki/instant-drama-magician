import { describe, expect, it } from 'vitest'
import { makeHandlerContext } from '../../test/handlerTestUtils'
import { registerAppBackupHandlers } from './appBackup'

describe('registerAppBackupHandlers', () => {
  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerAppBackupHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('app:exportFullBackup')).toBe(true)
    expect(handlers.has('app:importFullBackup')).toBe(true)
    expect(handlers.has('app:rebuildMenu')).toBe(true)
  })
})
