/**
 * Renderer entry for OS completion notifications.
 */
import { getApi, isElectron } from '../../lib/api'
import type { AppSettings } from '../../types/settings'
import {
  desktopNotifyTag,
  shouldNotify,
  type DesktopNotifyKind,
  type DesktopNotifyOutcome,
  type DesktopNotifyShowResult
} from '../../domain/desktopNotify'

export interface NotifyJobSettledInput {
  outcome: DesktopNotifyOutcome
  kind: DesktopNotifyKind
  label?: string
  startedAt: number
  tagScope?: string | null
  force?: boolean
  /** Override settings (tests / already-loaded page). */
  settings?: Pick<
    AppSettings,
    | 'desktopNotifyEnabled'
    | 'desktopNotifyWhenUnfocusedOnly'
    | 'desktopNotifyOnFailure'
    | 'desktopNotifySound'
  > | null
}

export function isAppForeground(): boolean {
  if (typeof document === 'undefined') return false
  try {
    return document.visibilityState === 'visible' && document.hasFocus()
  } catch {
    return false
  }
}

function prefsFrom(
  s: NotifyJobSettledInput['settings']
): {
  enabled: boolean
  unfocusedOnly: boolean
  notifyOnFailure: boolean
  sound: boolean
} {
  return {
    enabled: s?.desktopNotifyEnabled !== false,
    unfocusedOnly: s?.desktopNotifyWhenUnfocusedOnly !== false,
    notifyOnFailure: s?.desktopNotifyOnFailure !== false,
    sound: s?.desktopNotifySound !== false
  }
}

function bodyFor(
  input: NotifyJobSettledInput,
  t: (key: string, opts?: Record<string, string>) => string
): string {
  if (input.kind === 'test' || input.force) return t('notify.testBody')
  if (input.kind === 'export') {
    return input.outcome === 'succeeded'
      ? t('notify.exportDone')
      : t('notify.exportFail')
  }
  const fallback =
    input.kind === 'video'
      ? t('notify.videoReady')
      : input.kind === 'image'
        ? t('notify.imageReady')
        : t('notify.textReady')
  const label = input.label?.trim() || fallback
  if (input.outcome === 'failed' || input.outcome === 'degraded') {
    return t('notify.fail', { label })
  }
  return t('notify.done', { label })
}

async function loadSettings(): Promise<NotifyJobSettledInput['settings']> {
  try {
    const api = getApi()
    if (!api.settings?.get) return null
    return await api.settings.get()
  } catch {
    return null
  }
}

async function showOsNotification(payload: {
  title: string
  body: string
  silent?: boolean
  tag?: string
  unfocusedOnly?: boolean
}): Promise<DesktopNotifyShowResult> {
  if (isElectron()) {
    try {
      const api = getApi()
      if (api.desktopNotify?.show) {
        return (await api.desktopNotify.show(payload)) as DesktopNotifyShowResult
      }
    } catch (err) {
      return {
        ok: false,
        reason: 'error'
      }
    }
  }

  if (typeof Notification === 'undefined') {
    return { ok: false, reason: 'unsupported' }
  }
  try {
    let perm = Notification.permission
    if (perm === 'default') {
      perm = await Notification.requestPermission()
    }
    if (perm !== 'granted') return { ok: false, reason: 'denied' }
    new Notification(payload.title, {
      body: payload.body,
      silent: payload.silent,
      tag: payload.tag
    })
    return { ok: true }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

export async function notifyJobSettled(
  input: NotifyJobSettledInput
): Promise<DesktopNotifyShowResult> {
  const settings = input.settings ?? (await loadSettings())
  const prefs = prefsFrom(settings)
  const elapsedMs = Math.max(0, Date.now() - (input.startedAt || 0))
  const focused = isAppForeground()
  if (
    !shouldNotify({
      enabled: prefs.enabled,
      unfocusedOnly: prefs.unfocusedOnly,
      notifyOnFailure: prefs.notifyOnFailure,
      appFocused: focused,
      outcome: input.outcome,
      elapsedMs,
      force: input.force
    })
  ) {
    if (!prefs.enabled) return { ok: false, reason: 'disabled' }
    if (input.outcome === 'cancelled') return { ok: false, reason: 'cancelled' }
    if (prefs.unfocusedOnly && focused && !input.force) {
      return { ok: false, reason: 'focused' }
    }
    return { ok: false, reason: 'too-soon' }
  }

  const { default: i18n } = await import('../../lib/i18n')
  const t = (key: string, opts?: Record<string, string>): string =>
    i18n.t(key, opts)
  const title = t('notify.appName')
  const body = bodyFor(input, t)
  return showOsNotification({
    title,
    body,
    silent: !prefs.sound,
    tag: desktopNotifyTag(input.kind, input.tagScope),
    unfocusedOnly: prefs.unfocusedOnly && !input.force
  })
}

export function notifyJobSettledSafe(input: NotifyJobSettledInput): void {
  void notifyJobSettled(input).catch(() => undefined)
}

export function desktopNotifyKindFromJob(kind: string): DesktopNotifyKind {
  if (/(video|clip|intro)/i.test(kind)) return 'video'
  if (/(sheet|plate|cover|still|swap|atmosphere)/i.test(kind)) return 'image'
  return 'text'
}
