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
    return 'sceneNumber must be an integer >= 1'
  }
  return null
}

export function validateSceneDescription(description: string): string | null {
  if (description.trim().length === 0) return 'description is required'
  return null
}

export function nextSceneNumber(existingNumbers: readonly number[]): number {
  if (existingNumbers.length === 0) return 1
  return Math.max(...existingNumbers) + 1
}
