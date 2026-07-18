/**
 * Named atmosphere looks for a scene (JSON on Scene.looksJson).
 * Mirrors characterCostumes structure.
 */

export interface SceneLookEntry {
  id: string
  name: string
  description: string
  artStyle?: string | null
  imagePath?: string | null
  createdAt: string
  updatedAt: string
}

export function parseSceneLooks(
  json: string | null | undefined
): SceneLookEntry[] {
  if (!json?.trim()) return []
  try {
    const arr = JSON.parse(json) as unknown
    if (!Array.isArray(arr)) return []
    const out: SceneLookEntry[] = []
    for (const raw of arr) {
      if (!raw || typeof raw !== 'object') continue
      const o = raw as Record<string, unknown>
      const description =
        typeof o.description === 'string' ? o.description.trim() : ''
      if (!description) continue
      const now = new Date().toISOString()
      out.push({
        id:
          typeof o.id === 'string' && o.id
            ? o.id
            : `look_${out.length}_${Date.now()}`,
        name:
          typeof o.name === 'string' && o.name.trim()
            ? o.name.trim()
            : description.slice(0, 32),
        description,
        artStyle:
          typeof o.artStyle === 'string' && o.artStyle.trim()
            ? o.artStyle.trim()
            : null,
        imagePath:
          typeof o.imagePath === 'string' && o.imagePath
            ? o.imagePath
            : null,
        createdAt: typeof o.createdAt === 'string' ? o.createdAt : now,
        updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : now
      })
    }
    return out
  } catch {
    return []
  }
}

export function serializeSceneLooks(items: SceneLookEntry[]): string {
  return JSON.stringify(items)
}

export function createSceneLook(input: {
  name?: string
  description: string
  artStyle?: string | null
  imagePath?: string | null
}): SceneLookEntry {
  const description = input.description.trim()
  if (!description) throw new Error('Look description is required')
  const now = new Date().toISOString()
  return {
    id: `look_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: (input.name?.trim() || description.slice(0, 32)).trim(),
    description,
    artStyle: input.artStyle?.trim() || null,
    imagePath: input.imagePath ?? null,
    createdAt: now,
    updatedAt: now
  }
}

export function upsertSceneLook(
  items: SceneLookEntry[],
  entry: SceneLookEntry
): SceneLookEntry[] {
  const i = items.findIndex((x) => x.id === entry.id)
  if (i < 0) return [entry, ...items]
  const next = items.slice()
  next[i] = { ...entry, updatedAt: new Date().toISOString() }
  return next
}

export function removeSceneLook(
  items: SceneLookEntry[],
  id: string
): SceneLookEntry[] {
  return items.filter((x) => x.id !== id)
}

export function ensureLookInLibrary(
  items: SceneLookEntry[],
  text: string | null | undefined,
  opts?: { name?: string; artStyle?: string | null }
): SceneLookEntry[] {
  const description = text?.trim()
  if (!description) return items
  const hit = items.find(
    (x) => x.description.trim().toLowerCase() === description.toLowerCase()
  )
  if (hit) return items
  return [
    createSceneLook({
      name: opts?.name ?? 'Default',
      description,
      artStyle: opts?.artStyle
    }),
    ...items
  ]
}
