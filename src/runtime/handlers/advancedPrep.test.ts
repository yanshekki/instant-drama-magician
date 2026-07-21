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

  it('getAdvancedPrep, clearEntryStill, openFromStill delegate to service', async () => {
    const AdvancedPrepService = (
      await import('../../application/services/AdvancedPrepService')
    ).AdvancedPrepService
    const getSnapshot = vi
      .spyOn(AdvancedPrepService.prototype, 'getSnapshot')
      .mockResolvedValue({ storyId: 's1' } as never)
    const clearEntryStill = vi
      .spyOn(AdvancedPrepService.prototype, 'clearEntryStill')
      .mockResolvedValue({ ok: true } as never)
    const openFromStill = vi
      .spyOn(AdvancedPrepService.prototype, 'openFromStill')
      .mockResolvedValue({ stillPath: '/s.png' } as never)

    const ctx = makeHandlerContext({
      host: {
        ...(makeHandlerContext().host as object),
        getPrisma: () => ({}) as never
      } as never
    })
    registerAdvancedprepHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await expect(
      invokeRegistered(h as never, 'timeline:getAdvancedPrep', 's1')
    ).resolves.toMatchObject({ storyId: 's1' })
    await expect(
      invokeRegistered(h as never, 'timeline:clearEntryStill', 's1', 'e1')
    ).resolves.toMatchObject({ ok: true })
    await expect(
      invokeRegistered(h as never, 'videoPrep:openFromStill', {
        storyId: 's1',
        entryId: 'e1',
        locale: 'en',
        forcePolish: true
      })
    ).resolves.toMatchObject({ stillPath: '/s.png' })
    expect(getSnapshot).toHaveBeenCalled()
    expect(clearEntryStill).toHaveBeenCalled()
    expect(openFromStill).toHaveBeenCalled()
  })
})
