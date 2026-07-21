import { describe, expect, it, vi } from 'vitest'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerStoriesHandlers } from './stories'

describe('registerStoriesHandlers', () => {
  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerStoriesHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('stories:list')).toBe(true)
    expect(handlers.has('stories:get')).toBe(true)
    expect(handlers.has('stories:create')).toBe(true)
    expect(handlers.has('stories:update')).toBe(true)
  })

  it('invokes list/get/create/update via service', async () => {
    const svc = {
      list: vi.fn(async () => [{ id: 's1', title: 'A' }]),
      get: vi.fn(async (id: string) => ({ id, title: 'A' })),
      create: vi.fn(async (input: unknown) => ({ id: 's2', ...(input as object) })),
      update: vi.fn(async (id: string, data: unknown) => ({
        id,
        ...(data as object)
      })),
      delete: vi.fn(async (id: string) => ({ id }))
    }
    const ctx = makeHandlerContext({
      stories: () => svc as never
    })
    registerStoriesHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await expect(invokeRegistered(h as never, 'stories:list')).resolves.toEqual([
      { id: 's1', title: 'A' }
    ])
    await expect(
      invokeRegistered(h as never, 'stories:get', 's1')
    ).resolves.toMatchObject({ id: 's1' })
    await invokeRegistered(h as never, 'stories:create', {
      title: 'New',
      description: 'd'
    })
    expect(svc.create).toHaveBeenCalled()
    await invokeRegistered(h as never, 'stories:update', 's1', {
      title: 'Renamed',
      styleNote: 'neon'
    })
    expect(svc.update).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ title: 'Renamed' })
    )
  })
})
