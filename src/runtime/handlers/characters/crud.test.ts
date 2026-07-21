import { describe, expect, it, vi } from 'vitest'
import { makeHandlerContext, invokeRegistered } from '../../../test/handlerTestUtils'
import { registerCharactersCrud } from './crud'

describe('registerCharactersCrud', () => {
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
      characters: () => svc as never
    })
    registerCharactersCrud(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('characters:list')).toBe(true)
    await invokeRegistered(handlers as never, 'characters:list')
    expect(handlers.has('characters:get')).toBe(true)
    await invokeRegistered(handlers as never, 'characters:get', "id1")
    expect(handlers.has('characters:create')).toBe(true)
    await invokeRegistered(handlers as never, 'characters:create', {"name": "A"})
    expect(handlers.has('characters:update')).toBe(true)
    await invokeRegistered(handlers as never, 'characters:update', "id1", {"name": "B"})
    expect(handlers.has('characters:delete')).toBe(true)
    await invokeRegistered(handlers as never, 'characters:delete', "id1")
  })
})
