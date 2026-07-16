import type { StoryStatus } from '../types/domain'

const VALID_STATUSES: readonly StoryStatus[] = [
  'DRAFT',
  'GENERATING',
  'COMPLETED',
  'FAILED'
]

/** Validate and normalize a story title. */
export function normalizeStoryTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ')
}

export function validateStoryTitle(title: string): string | null {
  const normalized = normalizeStoryTitle(title)
  if (normalized.length === 0) return 'title is required'
  if (normalized.length > 200) return 'title must be at most 200 characters'
  return null
}

export function isStoryStatus(value: string): value is StoryStatus {
  return (VALID_STATUSES as readonly string[]).includes(value)
}

export function canStartGeneration(status: StoryStatus): boolean {
  return status === 'DRAFT' || status === 'FAILED' || status === 'COMPLETED'
}
