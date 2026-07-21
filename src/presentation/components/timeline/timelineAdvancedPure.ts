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


export function shouldSilentPersistOnGen(dirty: boolean): boolean {
  return dirty
}

export function shouldSilentPersistOnBatch(needSave: boolean): boolean {
  return needSave
}

export function stillStatusOrMissing(
  status: string | undefined | null
): string {
  return status || 'missing'
}


export async function runSaveCast(
  persist: () => Promise<unknown>,
  reload: () => Promise<unknown>
): Promise<void> {
  await persist()
  await reload()
}

export async function maybeSilentPersistDirty(
  dirty: boolean,
  setProgress: (n: number, m?: string) => void,
  persist: () => Promise<unknown>
): Promise<void> {
  if (!dirty) return
  setProgress(15, 'start')
  await persist()
}

export async function maybeSilentPersistBatch(
  needSave: boolean,
  persist: () => Promise<unknown>
): Promise<void> {
  if (!needSave) return
  await persist()
}

export function fireVideoQueue(
  onClose: () => void,
  onStart: (ids: string[], opts: { skipStill: boolean }) => void,
  ids: string[]
): void {
  onClose()
  onStart(ids, { skipStill: true })
}

export function notifyCastSaved(
  shouldToast: boolean,
  toastSuccess: () => void
): void {
  if (shouldToast) toastSuccess()
}
