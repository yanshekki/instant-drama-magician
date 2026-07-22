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

/**
 * Expand batch targets so a cell that needs prev-clip lock also pulls missing
 * previous beats into the queue (order preserved). Prevents silent text-only gens.
 */
export function expandBatchTargetsForContinuity<
  T extends {
    entryId: string
    stillStatus: string
    continuityKind?: 'first' | 'locked' | 'text-only'
  }
>(allCells: T[], targets: T[]): T[] {
  if (targets.length === 0 || allCells.length === 0) return targets
  const byId = new Map(allCells.map((c) => [c.entryId, c]))
  const orderIndex = new Map(allCells.map((c, i) => [c.entryId, i]))
  const need = new Set(targets.map((c) => c.entryId))

  for (const t of targets) {
    if (t.continuityKind !== 'text-only' && t.continuityKind !== 'locked') {
      continue
    }
    const idx = orderIndex.get(t.entryId)
    if (idx == null || idx <= 0) continue
    // Walk backward: include any previous missing/stale stills so lock can form.
    for (let i = idx - 1; i >= 0; i--) {
      const prev = allCells[i]
      if (!prev) break
      if (prev.stillStatus === 'ready') break
      need.add(prev.entryId)
    }
  }

  return allCells.filter((c) => need.has(c.entryId) && byId.has(c.entryId))
}

/** Short i18n key suffix for still badge title (caller prefixes timeline.advanced.) */
export function stillStatusHintKey(
  stillStatus: string,
  continuityKind?: string
): string {
  if (stillStatus === 'stale') return 'stillStaleHint'
  if (stillStatus === 'missing' && continuityKind === 'text-only') {
    return 'stillNeedPrevHint'
  }
  if (stillStatus === 'missing') return 'stillMissingHint'
  return 'stillReadyHint'
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
