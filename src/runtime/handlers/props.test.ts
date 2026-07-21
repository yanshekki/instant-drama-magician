import { describe, expect, it, vi } from 'vitest'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerPropsHandlers } from './props'

describe('registerPropsHandlers', () => {
  it('registers and invokes CRUD list variants', async () => {
    const svc = {
      list: vi.fn(async () => [{ id: 'p1' }]),
      listForStory: vi.fn(async () => [{ id: 'ps' }]),
      get: vi.fn(async (id: string) => ({ id })),
      create: vi.fn(async (input: unknown) => input),
      update: vi.fn(async (id: string, data: unknown) => ({
        id,
        ...(data as object)
      })),
      delete: vi.fn(async (id: string) => ({ id }))
    }
    const ctx = makeHandlerContext({ props: () => svc as never })
    registerPropsHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(h.has('props:list')).toBe(true)

    await invokeRegistered(h as never, 'props:list')
    expect(svc.list).toHaveBeenCalledWith({ q: undefined })
    await invokeRegistered(h as never, 'props:list', 'story1')
    expect(svc.listForStory).toHaveBeenCalledWith('story1')
    await invokeRegistered(h as never, 'props:list', {
      forStory: true,
      storyId: 's2'
    })
    expect(svc.listForStory).toHaveBeenCalledWith('s2')
    await invokeRegistered(h as never, 'props:list', { q: 'umbrella' })
    expect(svc.list).toHaveBeenCalledWith({ q: 'umbrella' })

    await invokeRegistered(h as never, 'props:create', {
      name: 'U',
      description: 'd'
    })
    await invokeRegistered(h as never, 'props:update', 'p1', { name: 'V' })
    await invokeRegistered(h as never, 'props:delete', 'p1')
    expect(svc.delete).toHaveBeenCalledWith('p1')
  })
})
