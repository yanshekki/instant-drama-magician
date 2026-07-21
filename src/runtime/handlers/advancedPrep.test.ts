import { describe, expect, it, vi } from 'vitest'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerAdvancedprepHandlers } from './advancedPrep'

describe('registerAdvancedprepHandlers', () => {
  it('registers advanced prep channels', () => {
    const ctx = makeHandlerContext()
    registerAdvancedprepHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('timeline:getAdvancedPrep')).toBe(true)
    expect(handlers.has('timeline:setCastPrep')).toBe(true)
    expect(handlers.has('timeline:clearEntryStill')).toBe(true)
    expect(handlers.has('videoPrep:openFromStill')).toBe(true)
  })

  it('setCastPrep normalizes and writes store', async () => {
    const writeStoryCastPrepJson = vi.fn()
    const ctx = makeHandlerContext({
      generation: () =>
        ({
          getMediaStore: () => ({
            writeStoryCastPrepJson,
            ensureLibraryDirs: vi.fn()
          }),
          cancel: vi.fn(),
          rebindAi: vi.fn()
        }) as never
    })
    registerAdvancedprepHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'timeline:setCastPrep', 's1', {
      characters: {
        c1: { refImagePath: '/a.png', costumeId: 'cos1' }
      }
    })) as { characters: Record<string, unknown> }
    expect(writeStoryCastPrepJson).toHaveBeenCalled()
    expect(r.characters.c1).toMatchObject({
      refImagePath: '/a.png',
      costumeId: 'cos1'
    })
  })
})
