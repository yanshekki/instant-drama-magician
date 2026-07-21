import { describe, expect, it, vi } from 'vitest'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerActionsHandlers } from './actions'

describe('registerActionsHandlers', () => {
  it('registers and invokes CRUD + link channels', async () => {
    const svc = {
      list: vi.fn(async () => [{ id: 'a1' }]),
      listForStory: vi.fn(async () => [{ id: 'as' }]),
      get: vi.fn(async (id: string) => ({ id })),
      create: vi.fn(async (input: unknown) => input),
      update: vi.fn(async (id: string, data: unknown) => ({
        id,
        ...(data as object)
      })),
      delete: vi.fn(async (id: string) => ({ id })),
      linkStory: vi.fn(async () => ({ ok: true })),
      unlinkStory: vi.fn(async () => ({ ok: true }))
    }
    const ctx = makeHandlerContext({ actions: () => svc as never })
    registerActionsHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await invokeRegistered(h as never, 'actions:list', { q: 'kick' })
    expect(svc.list).toHaveBeenCalledWith({ q: 'kick' })
    await invokeRegistered(h as never, 'actions:list', 'story1')
    expect(svc.listForStory).toHaveBeenCalledWith('story1')
    await invokeRegistered(h as never, 'actions:get', 'a1')
    await invokeRegistered(h as never, 'actions:create', {
      name: 'Kick',
      description: 'd'
    })
    await invokeRegistered(h as never, 'actions:update', 'a1', { name: 'K2' })
    await invokeRegistered(h as never, 'actions:delete', 'a1')
    await invokeRegistered(h as never, 'actions:linkStory', 's1', 'a1')
    await invokeRegistered(h as never, 'actions:unlinkStory', 's1', 'a1')
    expect(svc.linkStory).toHaveBeenCalledWith('s1', 'a1')
    expect(svc.unlinkStory).toHaveBeenCalledWith('s1', 'a1')
  })
})
