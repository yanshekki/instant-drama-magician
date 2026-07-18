import type { Scene } from '../../../types/domain'

export type StoryCastScene = Scene & { sceneNumber?: number }

/** Safe scene label — never emits `#undefined`. */
export function sceneCastLabel(s: StoryCastScene): string {
  const title = (s.title || s.description || '').trim()
  const short = title.slice(0, 36)
  if (s.sceneNumber != null && Number.isFinite(s.sceneNumber)) {
    return `#${s.sceneNumber} ${short}`.trim()
  }
  return short || s.id.slice(0, 8)
}
