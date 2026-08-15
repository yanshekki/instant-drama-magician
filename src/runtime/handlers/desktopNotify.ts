/**
 * Show an OS notification when a long AI / export wait settles.
 */
import type { DesktopNotifyShowInput } from '../../domain/desktopNotify'
import type { HandlerContext } from './context'

export function registerDesktopNotifyHandlers(ctx: HandlerContext): void {
  const { reg, host } = ctx

  reg('desktopNotify:show', async (raw: DesktopNotifyShowInput) => {
    const title = typeof raw?.title === 'string' ? raw.title.trim() : ''
    const body = typeof raw?.body === 'string' ? raw.body.trim() : ''
    if (!title && !body) {
      return { ok: false as const, reason: 'error' as const }
    }
    const show = host.showDesktopNotification
    if (!show) {
      return { ok: false as const, reason: 'unsupported' as const }
    }
    try {
      return await show({
        title: title || body,
        body,
        silent: Boolean(raw?.silent),
        tag: typeof raw?.tag === 'string' ? raw.tag : undefined,
        unfocusedOnly: Boolean(raw?.unfocusedOnly)
      })
    } catch (err) {
      return {
        ok: false as const,
        reason: 'error' as const,
        message: err instanceof Error ? err.message : String(err)
      }
    }
  })
}
