/**
 * Pure rules for OS completion notifications.
 * Renderer / main process decide how to display; this only answers "should we?".
 */
export const DESKTOP_NOTIFY_MIN_ELAPSED_MS = 5_000

export type DesktopNotifyOutcome =
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'degraded'

export type DesktopNotifyKind = 'text' | 'image' | 'video' | 'export' | 'test'

export interface ShouldNotifyInput {
  enabled: boolean
  unfocusedOnly: boolean
  notifyOnFailure: boolean
  appFocused: boolean
  outcome: DesktopNotifyOutcome
  elapsedMs: number
  /** Settings test button — skip duration / focus gates. */
  force?: boolean
}

export interface DesktopNotifyShowInput {
  title: string
  body: string
  silent?: boolean
  tag?: string
  unfocusedOnly?: boolean
}

export interface DesktopNotifyShowResult {
  ok: boolean
  reason?:
    | 'disabled'
    | 'focused'
    | 'cancelled'
    | 'too-soon'
    | 'unsupported'
    | 'denied'
    | 'no-settings'
    | 'error'
}

export function shouldNotify(input: ShouldNotifyInput): boolean {
  if (input.force) return input.enabled
  if (!input.enabled) return false
  if (input.outcome === 'cancelled') return false
  if (
    (input.outcome === 'failed' || input.outcome === 'degraded') &&
    !input.notifyOnFailure
  ) {
    return false
  }
  if (input.elapsedMs < DESKTOP_NOTIFY_MIN_ELAPSED_MS) return false
  if (input.unfocusedOnly && input.appFocused) return false
  return true
}

export function desktopNotifyTag(
  kind: DesktopNotifyKind,
  scope?: string | null
): string {
  const extra = scope?.trim()
  return extra ? `idm-${kind}-${extra}` : `idm-${kind}`
}
