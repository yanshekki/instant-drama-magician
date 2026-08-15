import {
  coerceComicVideoScheme,
  type ComicVideoScheme
} from './comicPageLayouts'

export type ComicPageVideo = {
  id: string
  path: string
  scheme: ComicVideoScheme
  createdAt: string
  label?: string
}

export function newComicPageVideoId(): string {
  return `cv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function parseComicPageVideos(
  json?: string | null,
  legacy?: { videoPath?: string | null }
): ComicPageVideo[] {
  const items: ComicPageVideo[] = []
  const seen = new Set<string>()
  if (json?.trim()) {
    try {
      const arr = JSON.parse(json) as unknown
      if (Array.isArray(arr)) {
        for (const raw of arr) {
          if (!raw || typeof raw !== 'object') continue
          const o = raw as Record<string, unknown>
          const path = typeof o.path === 'string' ? o.path.trim() : ''
          if (!path || seen.has(path)) continue
          seen.add(path)
          items.push({
            id:
              typeof o.id === 'string' && o.id.trim()
                ? o.id.trim()
                : `legacy_${items.length}`,
            path,
            scheme: coerceComicVideoScheme(
              typeof o.scheme === 'string' ? o.scheme : null
            ),
            createdAt:
              typeof o.createdAt === 'string'
                ? o.createdAt
                : new Date(0).toISOString(),
            ...(typeof o.label === 'string' && o.label.trim()
              ? { label: o.label.trim() }
              : {})
          })
        }
      }
    } catch {
      /* ignore corrupt */
    }
  }
  const legacyPath = legacy?.videoPath?.trim()
  if (legacyPath && !seen.has(legacyPath)) {
    items.push({
      id: 'legacy_primary',
      path: legacyPath,
      scheme: 'page',
      createdAt: new Date(0).toISOString()
    })
  }
  return items
}

export function serializeComicPageVideos(items: ComicPageVideo[]): string {
  return JSON.stringify(items)
}

export function prependComicPageVideo(
  items: ComicPageVideo[],
  next: ComicPageVideo
): ComicPageVideo[] {
  const rest = items.filter((v) => v.path !== next.path && v.id !== next.id)
  return [next, ...rest]
}

/** Prefer the pinned path when it is still in the gallery; else newest first. */
export function pickComicPagePrimary(
  items: ComicPageVideo[],
  preferred?: string | null
): string | null {
  if (items.length === 0) return null
  const pref = preferred?.trim()
  if (pref && items.some((v) => v.path === pref)) return pref
  return items[0]!.path
}
