/** Multi-image gallery for a character (stored as JSON on Character.refGalleryJson). */

export type CharacterImageKind = 'sheet' | 'upload' | 'gen'

export interface CharacterGalleryItem {
  id: string
  path: string
  kind: CharacterImageKind
  label: string
  createdAt: string
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
                : new Date().toISOString()
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

/** Primary image for video / cover (newest sheet preferred, else first). */
export function primaryGalleryPath(
  items: CharacterGalleryItem[]
): string | null {
  if (items.length === 0) return null
  const sheet = items.find((i) => i.kind === 'sheet')
  return (sheet ?? items[0]).path
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
    createdAt: item.createdAt ?? new Date().toISOString()
  }
  // newest first; de-dupe by path
  return [next, ...items.filter((i) => i.path !== next.path)]
}

export function removeGalleryItem(
  items: CharacterGalleryItem[],
  id: string
): CharacterGalleryItem[] {
  return items.filter((i) => i.id !== id)
}

function normalizeKind(k: unknown): CharacterImageKind {
  if (k === 'sheet' || k === 'upload' || k === 'gen') return k
  return 'gen'
}
