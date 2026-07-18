/**
 * Scene location gallery — same shape as character gallery, scene plate layers.
 */
import type { ScenePlateLayer } from './scenePlateVariants'
import { moveById, shiftById } from './galleryOrder'

export type SceneImageKind = 'sheet' | 'upload' | 'gen' | 'external'

/** User-imported stills for identity / style lock (Characters-parity). */
export function listSceneExternalRefs(
  items: SceneGalleryItem[]
): SceneGalleryItem[] {
  return items.filter((i) => i.kind === 'upload' || i.kind === 'external')
}

export function pickSceneExternalRefPath(
  items: SceneGalleryItem[],
  preferredPath?: string | null
): string | null {
  const ext = listSceneExternalRefs(items)
  if (ext.length === 0) return null
  const pref = preferredPath?.trim()
  if (pref && ext.some((e) => e.path === pref)) return pref
  return ext[0]!.path
}

export interface SceneGalleryItem {
  id: string
  path: string
  kind: SceneImageKind
  label: string
  createdAt: string
  layer?: ScenePlateLayer | string
  /** Location intro / establishing video from this still. */
  introVideoPath?: string | null
}

export const MAX_SCENE_IMAGE_EDIT_REFERENCES = 1

const LAYERS = new Set<string>([
  'identity',
  'hero',
  'establishing',
  'interior',
  'detail',
  'atmosphere',
  'time'
])

function normalizeLayer(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  return LAYERS.has(raw) ? raw : raw.trim() || undefined
}

function normalizeKind(k: unknown): SceneImageKind {
  if (k === 'sheet' || k === 'upload' || k === 'gen' || k === 'external')
    return k
  return 'gen'
}

export function parseSceneGallery(
  json: string | null | undefined,
  legacy?: { refImagePath?: string | null }
): SceneGalleryItem[] {
  const items: SceneGalleryItem[] = []
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
                : `simg_${items.length}_${Date.now()}`,
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
      /* ignore */
    }
  }
  if (legacy?.refImagePath && !seen.has(legacy.refImagePath)) {
    items.push({
      id: 'legacy_scene_0',
      path: legacy.refImagePath,
      kind: 'upload',
      label: 'Reference',
      createdAt: new Date(0).toISOString()
    })
  }
  return items
}

export function serializeSceneGallery(items: SceneGalleryItem[]): string {
  return JSON.stringify(items)
}

/** Attach / replace intro video on the gallery item matching source still. */
export function setSceneGalleryIntroVideo(
  items: SceneGalleryItem[],
  sourceImagePath: string,
  introVideoPath: string
): SceneGalleryItem[] {
  const src = sourceImagePath.trim()
  const vid = introVideoPath.trim()
  if (!src || !vid) return items
  return items.map((it) =>
    it.path === src ? { ...it, introVideoPath: vid } : it
  )
}

export function primarySceneGalleryPath(
  items: SceneGalleryItem[],
  preferredCoverPath?: string | null
): string | null {
  if (items.length === 0) return null
  if (preferredCoverPath) {
    const hit = items.find((i) => i.path === preferredCoverPath)
    if (hit) return hit.path
  }
  const sheet = items.find((i) => i.kind === 'sheet')
  return (sheet ?? items[0]).path
}

export function pickSceneReferencePaths(
  items: SceneGalleryItem[],
  max: number = MAX_SCENE_IMAGE_EDIT_REFERENCES,
  preferredPath?: string | null
): string[] {
  if (max <= 0 || items.length === 0) return []
  const ordered: SceneGalleryItem[] = []
  const push = (it: SceneGalleryItem): void => {
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

export function appendSceneGalleryItem(
  items: SceneGalleryItem[],
  item: Omit<SceneGalleryItem, 'id' | 'createdAt'> & {
    id?: string
    createdAt?: string
  }
): SceneGalleryItem[] {
  const next: SceneGalleryItem = {
    id: item.id ?? `simg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    path: item.path,
    kind: item.kind,
    label: item.label,
    createdAt: item.createdAt ?? new Date().toISOString(),
    ...(item.layer ? { layer: item.layer } : {})
  }
  return [next, ...items.filter((i) => i.path !== next.path)]
}

export function removeSceneGalleryItem(
  items: SceneGalleryItem[],
  id: string
): SceneGalleryItem[] {
  return items.filter((i) => i.id !== id)
}

export function moveSceneGalleryItem(
  items: SceneGalleryItem[],
  fromId: string,
  toId: string
): SceneGalleryItem[] {
  return moveById(items, fromId, toId)
}

export function shiftSceneGalleryItem(
  items: SceneGalleryItem[],
  id: string,
  delta: -1 | 1
): SceneGalleryItem[] {
  return shiftById(items, id, delta)
}

export function isSceneGalleryCoverPath(
  items: SceneGalleryItem[],
  path: string | null | undefined
): boolean {
  if (!path) return false
  return items.some((i) => i.path === path)
}

export function filterSceneGalleryByLayer(
  items: SceneGalleryItem[],
  layer: string | 'all'
): SceneGalleryItem[] {
  if (layer === 'all') return items.slice()
  return items.filter((i) => i.layer === layer)
}

export function inferSceneGalleryLayer(
  item: Pick<SceneGalleryItem, 'label' | 'layer'>
): string | null {
  if (item.layer) return item.layer
  const label = (item.label ?? '').toLowerCase()
  if (/establish/.test(label)) return 'establishing'
  if (/hero plate|hero/.test(label)) return 'hero'
  if (/identity/.test(label)) return 'identity'
  if (/day|night|rain|fog|golden|neon|atmosphere/.test(label)) {
    return 'atmosphere'
  }
  if (/material|signage|dressing|lighting|detail/.test(label)) return 'detail'
  if (/interior|pov|ots|¾|three/.test(label)) return 'interior'
  return null
}
