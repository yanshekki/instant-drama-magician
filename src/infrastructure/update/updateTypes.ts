import type { InstallChannel } from '../../domain/installChannel'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'dev-skipped'
  | 'web-skipped'

/** Coarse error classes for user-facing recovery hints */
export type UpdateErrorKind =
  | 'network'
  | 'feed'
  | 'signature'
  | 'disk'
  | 'permission'
  | 'unknown'

export type UpdateSource = 'github' | 'npm' | 'none'

/**
 * Unified update state for desktop (GitHub), CLI (npm), and informational channels.
 * Settings / Layout render from this + optional separate npm probe.
 */
export interface UpdateState {
  channel: InstallChannel
  status: UpdateStatus
  currentVersion: string
  latestVersion?: string
  progress?: number
  /** Human-readable fallback (English); prefer messageKey in UI */
  message?: string
  /** i18n key under settings.* */
  messageKey?: string
  releaseNotes?: string | null
  releaseUrl?: string
  /** Suggested shell command (npm install / manual download hint) */
  installCommand?: string
  /** Desktop: downloaded ready to quitAndInstall; CLI: writable global prefix */
  canAutoInstall: boolean
  /** Desktop packaged can download when available */
  canDownload: boolean
  /** Whether check is meaningful for this channel */
  canCheck: boolean
  errorKind?: UpdateErrorKind
  source: UpdateSource
}

export function classifyUpdateError(raw: string): UpdateErrorKind {
  const m = raw.toLowerCase()
  if (
    /enotfound|econnrefused|econnreset|etimedout|network|offline|fetch failed|aborted|dns/i.test(
      m
    )
  ) {
    return 'network'
  }
  if (/404|not found|latest-.*\.yml|cannot find channel|no published versions/i.test(m)) {
    return 'feed'
  }
  if (/signature|code sign|notariz|untrusted|certificate|csc_/i.test(m)) {
    return 'signature'
  }
  if (/enospc|no space|disk|edquot|erofs/i.test(m)) {
    return 'disk'
  }
  if (/eacces|eperm|permission|access denied|readonly/i.test(m)) {
    return 'permission'
  }
  return 'unknown'
}

export function emptyUpdateState(
  partial: Pick<UpdateState, 'channel' | 'currentVersion'> &
    Partial<UpdateState>
): UpdateState {
  return {
    status: 'idle',
    canAutoInstall: false,
    canDownload: false,
    canCheck: false,
    source: 'none',
    ...partial
  }
}
