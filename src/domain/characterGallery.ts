/** Multi-image gallery for a character (stored as JSON on Character.refGalleryJson). */

import type { WardrobeLayer } from './characterSheetVariants'
import { moveById, shiftById } from './galleryOrder'

export type CharacterImageKind = 'sheet' | 'upload' | 'gen' | 'external'

export interface CharacterGalleryItem {
  id: string
  path: string
  kind: CharacterImageKind
  label: string
  createdAt: string
  /** Wardrobe pipeline layer when known (costume-swap base selection). */
  layer?: WardrobeLayer
  /** Self-intro video generated from this still (one video per image). */
  introVideoPath?: string | null
}

/** User-imported stills used as optional AI identity / style references. */
export function isExternalRefItem(item: CharacterGalleryItem): boolean {
  return item.kind === 'external' || item.kind === 'upload'
}

export function listExternalRefs(
  items: CharacterGalleryItem[]
): CharacterGalleryItem[] {
  return items.filter(isExternalRefItem)
}

/**
 * Pick which still to feed image_edit when “use external ref” is on.
 * Prefer explicit path → selected external → first external.
 */
export function pickExternalRefPath(
  items: CharacterGalleryItem[],
  opts?: {
    preferredPath?: string | null
    selectedId?: string | null
  }
): string | null {
  const externals = listExternalRefs(items)
  if (externals.length === 0) return null
  const pref = opts?.preferredPath?.trim()
  if (pref && externals.some((e) => e.path === pref)) return pref
  if (opts?.selectedId) {
    const sel = items.find((i) => i.id === opts.selectedId)
    if (sel && isExternalRefItem(sel)) return sel.path
  }
  return externals[0]!.path
}

/**
 * Grok Gateway POST /v1/images/edits accepts a single multipart field `image`
 * (multer maxCount: 1). Keep this in sync with gateway upload-images middleware.
 */
export const MAX_IMAGE_EDIT_REFERENCES = 1

const WARDROBE_LAYERS: WardrobeLayer[] = [
  'identity',
  'nude',
  'base',
  'costume',
  'detail'
]

function normalizeLayer(raw: unknown): WardrobeLayer | undefined {
  if (typeof raw !== 'string') return undefined
  return WARDROBE_LAYERS.includes(raw as WardrobeLayer)
    ? (raw as WardrobeLayer)
    : undefined
}

export function parseCharacterGallery(
  json: string | null | undefined,
  legacy?: {
    refImagePath?: string | null
    refSheetPath?: string | null
  }
): CharacterGalleryItem[] {
  const items: CharacterGalleryItem[] = []
  const seen = new Set<string>()

  if (json?.trim()) {
    try {
      const arr = JSON.parse(json) as unknown
      if (Array.isArray(arr)) {
        for (const raw of arr) {
          if (!raw || typeof raw !== 'object') continue
          const o = raw as Record<string, unknown>
          const path = typeof o.path === 'string' ? o.path : ''
          if (!path || seen.has(path)) continue
          seen.add(path)
          const layer = normalizeLayer(o.layer)
          const introVideoPath =
            typeof o.introVideoPath === 'string' && o.introVideoPath.trim()
              ? o.introVideoPath.trim()
              : undefined
          items.push({
            id:
              typeof o.id === 'string' && o.id
                ? o.id
                : `img_${items.length}_${Date.now()}`,
            path,
            kind: normalizeKind(o.kind),
            label: typeof o.label === 'string' ? o.label : 'Image',
            createdAt:
              typeof o.createdAt === 'string'
                ? o.createdAt
                : new Date().toISOString(),
            ...(layer ? { layer } : {}),
            ...(introVideoPath ? { introVideoPath } : {})
          })
        }
      }
    } catch {
      // ignore corrupt
    }
  }

  // Migrate legacy single paths
  const legacyPaths = [legacy?.refSheetPath, legacy?.refImagePath].filter(
    (p): p is string => Boolean(p)
  )
  for (const path of legacyPaths) {
    if (seen.has(path)) continue
    seen.add(path)
    items.push({
      id: `legacy_${items.length}`,
      path,
      kind: path.includes('_sheet') ? 'sheet' : 'upload',
      label: path.includes('_sheet') ? 'Sheet' : 'Reference',
      createdAt: new Date(0).toISOString()
    })
  }

  return items
}

export function serializeCharacterGallery(
  items: CharacterGalleryItem[]
): string {
  return JSON.stringify(items)
}

/**
 * Primary image for video / library card cover.
 * Prefer explicit coverPath (Character.refImagePath) when still in gallery;
 * else newest sheet, else first item.
 */
export function primaryGalleryPath(
  items: CharacterGalleryItem[],
  preferredCoverPath?: string | null
): string | null {
  if (items.length === 0) return null
  if (preferredCoverPath) {
    const hit = items.find((i) => i.path === preferredCoverPath)
    if (hit) return hit.path
  }
  // Gallery is newest-first after appendGalleryItem
  const sheet = items.find((i) => i.kind === 'sheet')
  return (sheet ?? items[0]).path
}

/** Whether path is a valid cover candidate in the gallery. */
export function isGalleryCoverPath(
  items: CharacterGalleryItem[],
  path: string | null | undefined
): boolean {
  if (!path) return false
  return items.some((i) => i.path === path)
}

/**
 * Pick local image paths to send as edit references.
 * Respects API cap (default 1 for Grok Gateway /v1/images/edits).
 * Order: preferred path → newest sheets → other kinds.
 */
export function pickGalleryReferencePaths(
  items: CharacterGalleryItem[],
  max: number = MAX_IMAGE_EDIT_REFERENCES,
  preferredPath?: string | null
): string[] {
  if (max <= 0 || items.length === 0) return []
  const ordered: CharacterGalleryItem[] = []
  const push = (it: CharacterGalleryItem): void => {
    if (!ordered.some((o) => o.path === it.path)) ordered.push(it)
  }
  if (preferredPath) {
    const pref = items.find((i) => i.path === preferredPath)
    if (pref) push(pref)
  }
  for (const it of items.filter((i) => i.kind === 'sheet')) push(it)
  for (const it of items.filter((i) => i.kind !== 'sheet')) push(it)
  return ordered.slice(0, max).map((i) => i.path)
}

/** Attach / replace intro video path on the gallery item matching source still. */
export function setGalleryIntroVideo(
  items: CharacterGalleryItem[],
  sourceImagePath: string,
  introVideoPath: string
): CharacterGalleryItem[] {
  const src = sourceImagePath.trim()
  const vid = introVideoPath.trim()
  if (!src || !vid) return items
  let hit = false
  const next = items.map((it) => {
    if (it.path !== src) return it
    hit = true
    return { ...it, introVideoPath: vid }
  })
  return hit ? next : items
}

export function appendGalleryItem(
  items: CharacterGalleryItem[],
  item: Omit<CharacterGalleryItem, 'id' | 'createdAt'> & {
    id?: string
    createdAt?: string
  }
): CharacterGalleryItem[] {
  const next: CharacterGalleryItem = {
    id: item.id ?? `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    path: item.path,
    kind: item.kind,
    label: item.label,
    createdAt: item.createdAt ?? new Date().toISOString(),
    ...(item.layer ? { layer: item.layer } : {})
  }
  // newest first; de-dupe by path (each gen must use a unique file path)
  return [next, ...items.filter((i) => i.path !== next.path)]
}

export function removeGalleryItem(
  items: CharacterGalleryItem[],
  id: string
): CharacterGalleryItem[] {
  return items.filter((i) => i.id !== id)
}

/** Move gallery item `fromId` so it lands at the current index of `toId`. */
export function moveGalleryItem(
  items: CharacterGalleryItem[],
  fromId: string,
  toId: string
): CharacterGalleryItem[] {
  return moveById(items, fromId, toId)
}

/** Move item one step left (-1) or right (+1) in the list. */
export function shiftGalleryItem(
  items: CharacterGalleryItem[],
  id: string,
  delta: -1 | 1
): CharacterGalleryItem[] {
  return shiftById(items, id, delta)
}

/** Filter gallery by wardrobe layer; 'all' returns a copy. */
export function filterGalleryByLayer(
  items: CharacterGalleryItem[],
  layer: WardrobeLayer | 'all',
  opts?: {
    /** When true, drop nude items (minors). */
    hideNude?: boolean
    /** Optional layer inference for items missing layer field */
    inferLayer?: (
      item: CharacterGalleryItem
    ) => WardrobeLayer | null
  }
): CharacterGalleryItem[] {
  let list = items
  if (opts?.hideNude) {
    list = list.filter((it) => {
      const l = it.layer ?? opts.inferLayer?.(it) ?? null
      return l !== 'nude'
    })
  }
  if (layer === 'all') return list.slice()
  return list.filter((it) => {
    const l = it.layer ?? opts.inferLayer?.(it) ?? null
    return l === layer
  })
}

function normalizeKind(k: unknown): CharacterImageKind {
  if (k === 'sheet' || k === 'upload' || k === 'gen' || k === 'external')
    return k
  return 'gen'
}
