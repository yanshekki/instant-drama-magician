import { describe, expect, it, vi } from 'vitest'
import {
  makeHandlerContext,
  invokeRegistered
} from '../../../test/handlerTestUtils'
import { registerScenesCrud } from './crud'

describe('registerScenesCrud', () => {
  it('registers and invokes core channels with list variants', async () => {
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
      scenes: () => svc as never
    })
    registerScenesCrud(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('scenes:list')).toBe(true)

    await invokeRegistered(handlers as never, 'scenes:list')
    expect(svc.list).toHaveBeenCalledWith({ q: undefined })
    await invokeRegistered(handlers as never, 'scenes:list', 'story1')
    expect(svc.listForStory).toHaveBeenCalledWith('story1')
    await invokeRegistered(handlers as never, 'scenes:list', {
      forStory: true,
      storyId: 'story2'
    })
    await invokeRegistered(handlers as never, 'scenes:list', { q: 'alley' })
    expect(svc.list).toHaveBeenCalledWith({ q: 'alley' })

    await invokeRegistered(handlers as never, 'scenes:create', {
      description: 'd'
    })
    await invokeRegistered(handlers as never, 'scenes:update', 'id1', {
      description: 'e'
    })
    await invokeRegistered(handlers as never, 'scenes:delete', 'id1')
  })
})
