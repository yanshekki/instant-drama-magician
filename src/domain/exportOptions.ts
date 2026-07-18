/**
 * One-shot options shown when the user clicks “Export final film”.
 * Not a permanent Settings screen — last choices can still be remembered in AppSettings.
 */

export type ExportProfile = 'balanced' | 'fast'

export interface ExportFinalOptions {
  exportProfile: ExportProfile
  burnSubtitles: boolean
  includeSilentAudio: boolean
  openExportFolder: boolean
  bgmVolume: number
  dialogueVolume: number
}

export function defaultExportFinalOptions(
  partial?: Partial<ExportFinalOptions> | null
): ExportFinalOptions {
  return {
    exportProfile:
      partial?.exportProfile === 'fast' ? 'fast' : 'balanced',
    burnSubtitles: partial?.burnSubtitles ?? true,
    includeSilentAudio: partial?.includeSilentAudio ?? true,
    openExportFolder: partial?.openExportFolder ?? true,
    bgmVolume: clamp01(partial?.bgmVolume ?? 0.25),
    dialogueVolume: clamp01(partial?.dialogueVolume ?? 1)
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}
