import type { TFunction } from 'i18next'
import type { MediaStatus, SceneStatus } from '../../types/domain'

const MEDIA_STATUSES: readonly MediaStatus[] = [
  'EMPTY',
  'QUEUED',
  'GENERATING',
  'READY',
  'FAILED'
]

const SCENE_STATUSES: readonly SceneStatus[] = [
  'PENDING',
  'GENERATING',
  'COMPLETED',
  'FAILED'
]

/** Translate timeline / clip media status codes (READY, EMPTY, …). */
export function tMediaStatus(
  t: TFunction,
  status: string | null | undefined
): string {
  if (!status) return ''
  if ((MEDIA_STATUSES as readonly string[]).includes(status)) {
    return t(`media.status.${status}`)
  }
  return status
}

/** Translate scene entity status codes (PENDING, COMPLETED, …). */
export function tSceneStatus(
  t: TFunction,
  status: string | null | undefined
): string {
  if (!status) return ''
  if ((SCENE_STATUSES as readonly string[]).includes(status)) {
    return t(`scenes.status.${status}`)
  }
  return status
}

/** AI / form locationType codes (interior, exterior, mixed, …). */
const LOCATION_TYPES = [
  'interior',
  'exterior',
  'mixed',
  'vehicle',
  'virtual'
] as const

/**
 * Translate scene locationType for badges/UI.
 * Unknown free-text values are returned as-is.
 */
export function tSceneLocationType(
  t: TFunction,
  locationType: string | null | undefined
): string {
  if (!locationType?.trim()) return ''
  const raw = locationType.trim()
  const key = raw.toLowerCase().replace(/\s+/g, '_')
  if ((LOCATION_TYPES as readonly string[]).includes(key)) {
    const translated = t(`scenes.locationTypeValue.${key}`)
    if (translated !== `scenes.locationTypeValue.${key}`) return translated
  }
  // Also try common variants
  const slug = key.replace(/-/g, '_')
  const translated = t(`scenes.locationTypeValue.${slug}`, {
    defaultValue: ''
  })
  return translated || raw
}
