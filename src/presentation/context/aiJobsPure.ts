/**
 * Pure helpers for AiJobsContext residual paths.
 */

export function persistJobsSafe(write: () => void): void {
  try {
    write()
  } catch {
    /* quota / private mode */
  }
}

export function loadDraftStoreSafe<T extends object>(
  load: () => T,
  empty: T
): T {
  try {
    return load()
  } catch {
    return empty
  }
}

export function pipelineProgressPct(
  total: number,
  index: number,
  fallback: number
): number {
  if (total > 0) {
    return Math.min(99, Math.round(((index + 1) / total) * 100))
  }
  return fallback
}

export function optionalEl(cond: boolean): 'show' | 'hide' {
  return cond ? 'show' : 'hide'
}
