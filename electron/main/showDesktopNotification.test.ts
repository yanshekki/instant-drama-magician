import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  createShowDesktopNotification,
  resetDesktopNotifyTags,
  type NotifyHandle,
  type NotifyWindowLike
} from './showDesktopNotification'

function fakeWin(over: Partial<NotifyWindowLike> = {}): NotifyWindowLike {
  return {
    isDestroyed: () => false,
    isFocused: () => false,
    isVisible: () => true,
    isMinimized: () => false,
    restore: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    ...over
  }
}

describe('createShowDesktopNotification', () => {
  beforeEach(() => {
    resetDesktopNotifyTags()
  })

  it('returns unsupported when the OS cannot notify', async () => {
    const show = createShowDesktopNotification({
      isSupported: () => false,
      create: () => {
        throw new Error('no')
      },
      getMainWindow: () => null
    })
    expect(await show({ title: 't', body: 'b' })).toEqual({
      ok: false,
      reason: 'unsupported'
    })
  })

  it('skips when unfocused-only and the window is focused', async () => {
    const create = vi.fn()
    const show = createShowDesktopNotification({
      isSupported: () => true,
      create,
      getMainWindow: () => fakeWin({ isFocused: () => true })
    })
    expect(
      await show({ title: 't', body: 'b', unfocusedOnly: true })
    ).toEqual({ ok: false, reason: 'focused' })
    expect(create).not.toHaveBeenCalled()
  })

  it('shows, replaces same tag, and focuses on click', async () => {
    const handles: NotifyHandle[] = []
    const create = vi.fn(
      (opts: { title: string; body: string; icon?: string }) => {
        const listeners: Record<string, () => void> = {}
        const h: NotifyHandle = {
          show: vi.fn(),
          close: vi.fn(),
          on: (ev, cb) => {
            listeners[ev] = cb
          }
        }
        ;(h as NotifyHandle & { fire: (ev: string) => void }).fire = (ev) =>
          listeners[ev]?.()
        handles.push(h)
        expect(opts.icon).toBe('/icon.png')
        return h
      }
    )
    const win = fakeWin({ isMinimized: () => true })
    const show = createShowDesktopNotification({
      isSupported: () => true,
      create,
      getMainWindow: () => win,
      iconPath: '/icon.png'
    })
    expect(
      await show({ title: 't', body: 'one', tag: 'clip' })
    ).toEqual({ ok: true })
    expect(
      await show({ title: 't', body: 'two', tag: 'clip' })
    ).toEqual({ ok: true })
    expect(handles[0].close).toHaveBeenCalled()
    expect(handles[1].show).toHaveBeenCalled()
    ;(handles[1] as NotifyHandle & { fire: (ev: string) => void }).fire(
      'click'
    )
    expect(win.restore).toHaveBeenCalled()
    expect(win.show).toHaveBeenCalled()
    expect(win.focus).toHaveBeenCalled()
  })
})
