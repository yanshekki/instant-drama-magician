import { describe, expect, it, vi } from 'vitest'
import {
  makeHandlerContext,
  invokeRegistered
} from '../../../test/handlerTestUtils'
import { registerCharactersCrud } from './crud'

describe('registerCharactersCrud', () => {
  it('registers and invokes core channels', async () => {
    const svc = {
      list: vi.fn(async () => [{ id: '1' }]),
      listForStory: vi.fn(async () => [{ id: 's1' }]),
      get: vi.fn(async (id: string) => ({ id })),
      create: vi.fn(async (input: unknown) => input),
      update: vi.fn(async (id: string, data: unknown) => ({
        id,
        ...(data as object)
      })),
      delete: vi.fn(async (id: string) => ({ ok: true, id }))
    }
    const ctx = makeHandlerContext({
      characters: () => svc as never
    })
    registerCharactersCrud(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('characters:list')).toBe(true)

    await invokeRegistered(handlers as never, 'characters:list')
    expect(svc.list).toHaveBeenCalledWith({ q: undefined })

    await invokeRegistered(handlers as never, 'characters:list', 'story1')
    expect(svc.listForStory).toHaveBeenCalledWith('story1')

    await invokeRegistered(handlers as never, 'characters:list', {
      forStory: true,
      storyId: 'story2'
    })
    expect(svc.listForStory).toHaveBeenCalledWith('story2')

    await invokeRegistered(handlers as never, 'characters:list', { q: 'bob' })
    expect(svc.list).toHaveBeenCalledWith({ q: 'bob' })

    await invokeRegistered(handlers as never, 'characters:get', 'id1')
    await invokeRegistered(handlers as never, 'characters:create', {
      name: 'A'
    })
    await invokeRegistered(handlers as never, 'characters:update', 'id1', {
      name: 'B'
    })
    await invokeRegistered(handlers as never, 'characters:delete', 'id1')
    expect(svc.delete).toHaveBeenCalledWith('id1')
  })
})
