import { describe, expect, it, vi } from 'vitest'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerCostumesHandlers } from './costumes'

describe('registerCostumesHandlers', () => {
  it('registers and invokes core costume CRUD', async () => {
    const svc = {
      list: vi.fn(async () => [{ id: 'cos1' }]),
      get: vi.fn(async (id: string) => ({ id })),
      create: vi.fn(async (input: unknown) => input),
      update: vi.fn(async (id: string, data: unknown) => ({
        id,
        ...(data as object)
      })),
      delete: vi.fn(async (id: string) => ({ id }))
    }
    const ctx = makeHandlerContext({ costumes: () => svc as never })
    registerCostumesHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(h.has('costumes:list')).toBe(true)

    await invokeRegistered(h as never, 'costumes:list', { q: 'rain' })
    expect(svc.list).toHaveBeenCalledWith({ q: 'rain' })
    await invokeRegistered(h as never, 'costumes:get', 'cos1')
    await invokeRegistered(h as never, 'costumes:create', {
      name: 'Rain',
      description: 'coat'
    })
    await invokeRegistered(h as never, 'costumes:update', 'cos1', {
      name: 'Rain2'
    })
    if (h.has('costumes:delete')) {
      await invokeRegistered(h as never, 'costumes:delete', 'cos1')
    }
  })
})
