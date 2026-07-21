import { describe, expect, it, vi } from 'vitest'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerTimelineHandlers } from './timeline'

describe('registerTimelineHandlers', () => {
  it('registers and invokes timeline channels', async () => {
    const svc = {
      list: vi.fn(async () => [{ id: 'e1' }]),
      create: vi.fn(async (input: unknown) => input),
      update: vi.fn(async (id: string, data: unknown) => ({
        id,
        ...(data as object)
      })),
      delete: vi.fn(async (id: string) => ({ id })),
      reorder: vi.fn(async () => ({ ok: true })),
      setMedia: vi.fn(async (id: string, data: unknown) => ({
        id,
        ...(data as object)
      }))
    }
    const ctx = makeHandlerContext({
      timeline: () => svc as never
    })
    registerTimelineHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(h.has('timeline:list')).toBe(true)

    await expect(
      invokeRegistered(h as never, 'timeline:list', 's1')
    ).resolves.toEqual([{ id: 'e1' }])
    expect(svc.list).toHaveBeenCalledWith('s1')

    await invokeRegistered(h as never, 'timeline:create', {
      storyId: 's1',
      startTime: 0,
      endTime: 6
    })
    expect(svc.create).toHaveBeenCalled()

    await invokeRegistered(h as never, 'timeline:update', 'e1', {
      dialogue: 'hi'
    })
    expect(svc.update).toHaveBeenCalledWith('e1', { dialogue: 'hi' })

    await invokeRegistered(h as never, 'timeline:delete', 'e1')
    await invokeRegistered(h as never, 'timeline:reorder', 's1', ['e1', 'e2'])
    expect(svc.reorder).toHaveBeenCalledWith('s1', ['e1', 'e2'])

    await invokeRegistered(h as never, 'timeline:setMedia', 'e1', {
      mediaStatus: 'READY',
      mediaPath: '/v.mp4'
    })
    expect(svc.setMedia).toHaveBeenCalled()
  })
})
