import {
  coerceKeyArtMakeMethod,
  type KeyArtMakeMethodId
} from './keyArtMakeMethods'

export type KeyArtShotImage = {
  id: string
  path: string
  method: KeyArtMakeMethodId
  createdAt: string
  label?: string
}

export function newKeyArtShotImageId(): string {
  return `ka_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function parseKeyArtShotImages(
  json?: string | null,
  legacy?: { imagePath?: string | null }
): KeyArtShotImage[] {
  const items: KeyArtShotImage[] = []
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
            method: coerceKeyArtMakeMethod(
              typeof o.method === 'string' ? o.method : null
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
  const legacyPath = legacy?.imagePath?.trim()
  if (legacyPath && !seen.has(legacyPath)) {
    items.push({
      id: 'legacy_primary',
      path: legacyPath,
      method: 'fresh',
      createdAt: new Date(0).toISOString()
    })
  }
  return items
}

export function serializeKeyArtShotImages(items: KeyArtShotImage[]): string {
  return JSON.stringify(items)
}

export function prependKeyArtShotImage(
  items: KeyArtShotImage[],
  next: KeyArtShotImage
): KeyArtShotImage[] {
  const rest = items.filter((v) => v.path !== next.path && v.id !== next.id)
  return [next, ...rest]
}

export function pickKeyArtShotPrimary(
  items: KeyArtShotImage[],
  preferred?: string | null
): string | null {
  if (items.length === 0) return null
  const pref = preferred?.trim()
  if (pref && items.some((v) => v.path === pref)) return pref
  return items[0]!.path
}
