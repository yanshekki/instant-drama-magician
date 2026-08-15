import { describe, expect, it, vi } from 'vitest'
import { makeHandlerContext } from '../../test/handlerTestUtils'
import { registerDesktopNotifyHandlers } from './desktopNotify'

describe('registerDesktopNotifyHandlers', () => {
  it('registers the channel and no-ops without a host hook', async () => {
    const ctx = makeHandlerContext()
    registerDesktopNotifyHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('desktopNotify:show')).toBe(true)
    const fn = handlers.get('desktopNotify:show') as (
      raw: unknown
    ) => Promise<{ ok: boolean; reason?: string }>
    expect(await fn({ title: 'T', body: 'B' })).toEqual({
      ok: false,
      reason: 'unsupported'
    })
    expect(await fn({ title: '', body: '' })).toEqual({
      ok: false,
      reason: 'error'
    })
  })

  it('forwards a valid payload to the host hook', async () => {
    const show = vi.fn(async () => ({ ok: true as const }))
    const ctx = makeHandlerContext({
      host: { showDesktopNotification: show }
    })
    registerDesktopNotifyHandlers(ctx)
    const fn = (
      ctx as { handlers: Map<string, (raw: unknown) => Promise<unknown>> }
    ).handlers.get('desktopNotify:show')!
    await fn({
      title: ' InstantDrama ',
      body: ' done ',
      silent: true,
      tag: 'idm-video',
      unfocusedOnly: true
    })
    expect(show).toHaveBeenCalledWith({
      title: 'InstantDrama',
      body: 'done',
      silent: true,
      tag: 'idm-video',
      unfocusedOnly: true
    })
    show.mockRejectedValueOnce(new Error('boom'))
    const fail = await fn({ title: 'T', body: 'B' })
    expect(fail).toMatchObject({ ok: false, reason: 'error' })

    await fn({ body: 'only-body' })
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'only-body', body: 'only-body' })
    )
    show.mockRejectedValueOnce('string-fail')
    const fail2 = await fn({ title: 'T' })
    expect(fail2).toMatchObject({ ok: false, reason: 'error' })
  })
})
