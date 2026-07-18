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
