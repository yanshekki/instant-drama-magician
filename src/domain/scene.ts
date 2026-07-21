import type { SceneStatus } from '../types/domain'

const VALID_STATUSES: readonly SceneStatus[] = [
  'PENDING',
  'GENERATING',
  'COMPLETED',
  'FAILED'
]

export function isSceneStatus(value: string): value is SceneStatus {
  return (VALID_STATUSES as readonly string[]).includes(value)
}

export function validateSceneNumber(sceneNumber: number): string | null {
  if (!Number.isInteger(sceneNumber) || sceneNumber < 1) {
    return 'errors.sceneNumberInvalid'
  }
  return null
}

export function validateSceneDescription(description: string): string | null {
  if (description.trim().length === 0) return 'errors.descriptionRequired'
  return null
}

/**
 * Next free per-story scene index. Ignores undefined/NaN (global library rows
 * often have no story-scoped sceneNumber).
 */
export function nextSceneNumber(
  existingNumbers: readonly (number | null | undefined)[]
): number {
  const nums = existingNumbers.filter(
    (n): n is number =>
      typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n) && n >= 1
  )
  if (nums.length === 0) return 1
  return Math.max(...nums) + 1
}

/** Coerce form/IPC scene number to a safe integer ≥ 1, or null if absent. */
export function coerceSceneNumber(
  value: unknown
): number | null {
  if (value === undefined || value === null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  return n
}
