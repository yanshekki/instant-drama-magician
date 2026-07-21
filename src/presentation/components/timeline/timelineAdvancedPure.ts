/**
 * Pure helpers for TimelineAdvancedStudio residual branches (unit-testable).
 */

export function castSaveToast(silent: boolean | undefined): 'success' | 'skip' {
  return silent ? 'skip' : 'success'
}

export function stillReadyDecrement(stillStatus: string): number {
  return stillStatus !== 'missing' ? 1 : 0
}

export function batchTargets<T extends { stillStatus: string }>(
  cells: T[],
  mode: 'all' | 'missing'
): T[] {
  return mode === 'all' ? cells : cells.filter((c) => c.stillStatus !== 'ready')
}

export function genLockedExtra(
  batchProgress: { current: number; total: number } | null | undefined,
  cellBusyId: string | null | undefined,
  batchLabel: string,
  generatingLabel: string
): string {
  if (batchProgress) return ` · ${batchLabel}`
  if (cellBusyId) return ` · ${generatingLabel}`
  return ''
}

export function readyVideoEntryIds(
  cells: Array<{ entryId: string; stillStatus: string }>
): string[] {
  return cells
    .filter((c) => c.stillStatus === 'ready' || c.stillStatus === 'stale')
    .map((c) => c.entryId)
}
