import { describe, expect, it, vi } from 'vitest'
import { makeHandlerContext, invokeRegistered } from '../../../test/handlerTestUtils'
import { registerScenesCrud } from './crud'

describe('registerScenesCrud', () => {
  it('registers and invokes core channels', async () => {
    const svc = {
      list: vi.fn(async () => [{ id: '1' }]),
      listForStory: vi.fn(async () => [{ id: 's1' }]),
      get: vi.fn(async (id: string) => ({ id })),
      create: vi.fn(async (input: unknown) => input),
      update: vi.fn(async (id: string, data: unknown) => ({ id, ...(data as object) })),
      delete: vi.fn(async (id: string) => ({ ok: true, id }))
    }
    const ctx = makeHandlerContext({
      scenes: () => svc as never
    })
    registerScenesCrud(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('scenes:list')).toBe(true)
    await invokeRegistered(handlers as never, 'scenes:list')
    expect(handlers.has('scenes:create')).toBe(true)
    await invokeRegistered(handlers as never, 'scenes:create', {"description": "d"})
    expect(handlers.has('scenes:update')).toBe(true)
    await invokeRegistered(handlers as never, 'scenes:update', "id1", {"description": "e"})
    expect(handlers.has('scenes:delete')).toBe(true)
    await invokeRegistered(handlers as never, 'scenes:delete', "id1")
  })
})
