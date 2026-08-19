/**
 * Orchestrate multi-still identity lock within the existing MediaGen path.
 * Pixel edits stay capped at MAX_IMAGE_EDIT_REFERENCES (1). Extra stills
 * go to multi-vision polish; optional collage stitches refs into one edit base.
 */
import {
  MAX_IMAGE_EDIT_REFERENCES,
  type CharacterGalleryItem
} from './characterGallery'
import { MULTI_VISION_MAX_IMAGES } from './visionLimits'

const IDENTITY_LABEL =
  /identity\s*lock|face\s*id|bible|身份鎖定|臉部鎖定/i

export function isIdentityLockLabel(label?: string | null): boolean {
  return Boolean(label && IDENTITY_LABEL.test(label))
}

/**
 * Prefer identity-layer / labelled lock plates, then sheets, then the rest.
 * Selected paths win when provided.
 */
export function pickAdvancedIdentityRefs(
  items: CharacterGalleryItem[],
  opts?: {
    selectedPaths?: string[] | null
    max?: number
    pathExists?: (path: string) => boolean
  }
): string[] {
  const max = Math.max(
    1,
    Math.min(opts?.max ?? MULTI_VISION_MAX_IMAGES, MULTI_VISION_MAX_IMAGES)
  )
  const exists = opts?.pathExists ?? (() => true)
  const selected = (opts?.selectedPaths ?? [])
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p) && exists(p))

  const ordered: CharacterGalleryItem[] = []
  const seen = new Set<string>()
  const push = (it: CharacterGalleryItem | undefined): void => {
    if (!it?.path || seen.has(it.path) || !exists(it.path)) return
    seen.add(it.path)
    ordered.push(it)
  }

  for (const p of selected) {
    push(items.find((i) => i.path === p))
  }
  for (const it of items.filter((i) => i.identityLock || i.layer === 'identity')) {
    push(it)
  }
  for (const it of items.filter((i) => isIdentityLockLabel(i.label))) {
    push(it)
  }
  for (const it of items.filter((i) => i.kind === 'sheet')) push(it)
  for (const it of items) push(it)

  return ordered.slice(0, max).map((i) => i.path)
}

export function markGalleryIdentityLock(
  items: CharacterGalleryItem[],
  paths: string[]
): CharacterGalleryItem[] {
  const set = new Set(paths.map((p) => p.trim()).filter(Boolean))
  if (set.size === 0) return items
  return items.map((it) =>
    set.has(it.path) ? { ...it, identityLock: true } : it
  )
}

/** Flip identityLock on the matching still. Does not clear other pins. */
export function toggleGalleryIdentityLock(
  items: CharacterGalleryItem[],
  path: string
): CharacterGalleryItem[] {
  const p = path.trim()
  if (!p) return items
  return items.map((it) => {
    if (it.path !== p) return it
    if (it.identityLock) {
      const next = { ...it }
      delete next.identityLock
      return next
    }
    return { ...it, identityLock: true }
  })
}

export function galleryHasPersistedIdentityLock(
  items: CharacterGalleryItem[]
): boolean {
  return items.some((it) => it.identityLock === true || it.layer === 'identity')
}

/** First path is the pixel edit base (API cap = 1). */
export function pickIdentityEditBase(paths: string[]): string | null {
  const first = paths[0]?.trim()
  return first || null
}

export function identityEditCap(): number {
  return MAX_IMAGE_EDIT_REFERENCES
}

/** How many stills to stitch into one collage plate (2–4). */
export function collageSourcePaths(paths: string[], max = 4): string[] {
  const uniq: string[] = []
  for (const p of paths) {
    const t = p?.trim()
    if (!t || uniq.includes(t)) continue
    uniq.push(t)
    if (uniq.length >= max) break
  }
  return uniq
}
