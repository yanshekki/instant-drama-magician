/**
 * Electron main-process OS notification (Linux / Windows / macOS).
 */
import type {
  DesktopNotifyShowInput,
  DesktopNotifyShowResult
} from '../../src/domain/desktopNotify'

export interface NotifyWindowLike {
  isDestroyed: () => boolean
  isFocused: () => boolean
  isVisible: () => boolean
  isMinimized: () => boolean
  restore: () => void
  show: () => void
  focus: () => void
}

export interface NotifyHandle {
  show: () => void
  close: () => void
  on: (ev: 'click' | 'close', cb: () => void) => void
}

export interface ShowDesktopNotificationDeps {
  isSupported: () => boolean
  create: (opts: {
    title: string
    body: string
    silent?: boolean
    icon?: string
  }) => NotifyHandle
  getMainWindow: () => NotifyWindowLike | null
  iconPath?: string | null
}

const byTag = new Map<string, NotifyHandle>()

export function createShowDesktopNotification(
  deps: ShowDesktopNotificationDeps
): (input: DesktopNotifyShowInput) => Promise<DesktopNotifyShowResult> {
  return async (input) => {
    if (!deps.isSupported()) {
      return { ok: false, reason: 'unsupported' }
    }
    if (input.unfocusedOnly) {
      const win = deps.getMainWindow()
      if (
        win &&
        !win.isDestroyed() &&
        win.isFocused() &&
        win.isVisible()
      ) {
        return { ok: false, reason: 'focused' }
      }
    }

    const tag = input.tag?.trim()
    if (tag) {
      const prev = byTag.get(tag)
      if (prev) {
        try {
          prev.close()
        } catch {
          /* already gone */
        }
        byTag.delete(tag)
      }
    }

    const n = deps.create({
      title: input.title,
      body: input.body,
      silent: input.silent,
      ...(deps.iconPath ? { icon: deps.iconPath } : {})
    })

    n.on('click', () => {
      const win = deps.getMainWindow()
      if (!win || win.isDestroyed()) return
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    })
    n.on('close', () => {
      if (tag && byTag.get(tag) === n) byTag.delete(tag)
    })
    if (tag) byTag.set(tag, n)
    n.show()
    return { ok: true }
  }
}

/** Test helper — clear tag map between cases. */
export function resetDesktopNotifyTags(): void {
  byTag.clear()
}
