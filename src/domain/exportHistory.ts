/**
 * Per-story export film history (all versions), persisted under media exports.
 */

export type ExportKind = 'final' | 'board'

export interface ExportHistoryItem {
  id: string
  storyId: string
  kind: ExportKind
  fileName: string
  /** Preferred playable path (public Videos copy when available). */
  path: string
  /** Intermediate work file under app media (optional). */
  workPath?: string | null
  createdAt: string
  sizeBytes?: number | null
}

export function makeExportHistoryId(): string {
  return `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function sortExportHistoryNewestFirst(
  items: ExportHistoryItem[]
): ExportHistoryItem[] {
  return [...items].sort((a, b) => {
    const ta = Date.parse(a.createdAt) || 0
    const tb = Date.parse(b.createdAt) || 0
    if (tb !== ta) return tb - ta
    return (b.fileName || '').localeCompare(a.fileName || '')
  })
}

export function parseExportHistoryJson(
  raw: string | null | undefined,
  storyId: string
): ExportHistoryItem[] {
  if (!raw?.trim()) return []
  try {
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    const out: ExportHistoryItem[] = []
    for (const row of data) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const path = typeof r.path === 'string' ? r.path.trim() : ''
      if (!path) continue
      const kind: ExportKind = r.kind === 'board' ? 'board' : 'final'
      const fileName =
        typeof r.fileName === 'string' && r.fileName.trim()
          ? r.fileName.trim()
          : path.split(/[/\\]/).pop() || path
      const createdAt =
        typeof r.createdAt === 'string' && r.createdAt
          ? r.createdAt
          : new Date(0).toISOString()
      const id =
        typeof r.id === 'string' && r.id.trim()
          ? r.id.trim()
          : `exp_${fileName}`
      out.push({
        id,
        storyId:
          typeof r.storyId === 'string' && r.storyId ? r.storyId : storyId,
        kind,
        fileName,
        path,
        workPath:
          typeof r.workPath === 'string' && r.workPath.trim()
            ? r.workPath.trim()
            : null,
        createdAt,
        sizeBytes:
          typeof r.sizeBytes === 'number' && Number.isFinite(r.sizeBytes)
            ? r.sizeBytes
            : null
      })
    }
    return sortExportHistoryNewestFirst(out)
  } catch {
    return []
  }
}

export function serializeExportHistory(items: ExportHistoryItem[]): string {
  return JSON.stringify(sortExportHistoryNewestFirst(items), null, 2)
}

/** Infer kind from filename convention used by GenerationService. */
export function inferExportKindFromFileName(fileName: string): ExportKind {
  if (/_board_\d+/i.test(fileName) || /_board\./i.test(fileName)) return 'board'
  return 'final'
}

/**
 * User-facing export films only — skip FFmpeg intermediates
 * (`_fnorm_*`, `_raw_*`, `_ffallback_*`, …).
 */
export function isUserFacingExportFileName(fileName: string): boolean {
  const name = fileName.trim()
  if (!name || name.startsWith('.')) return false
  if (!/\.(mp4|mov|webm|mkv)$/i.test(name)) return false
  // FFmpeg work files in the same exports dir
  if (name.startsWith('_')) return false
  if (/^fallback_\d+/i.test(name)) return false
  // Prefer named final/board products; also keep bare non-temp copies
  if (/_(final|board)(_\d+)?\./i.test(name)) return true
  // Any other non-underscore mp4 left in the story exports folder
  return true
}

/** Pull epoch ms from `…_final_1712345678901.mp4` style names. */
export function createdAtFromExportFileName(fileName: string): string | null {
  const m = fileName.match(/_(\d{10,13})\.[a-z0-9]+$/i)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n < 1e11) return null
  return new Date(n).toISOString()
}
