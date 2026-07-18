/**
 * Named wardrobe library per character (JSON on Character.costumesJson).
 * Active costume mirrors Character.costume for video / sheet prompts.
 */

export interface CharacterCostumeEntry {
  id: string
  /** Short display name, e.g. "Raincoat set" */
  name: string
  /** Full costume description for prompts / costume-swap */
  description: string
  /** Preferred art style for this look (optional) */
  artStyle?: string | null
  /** Linked gallery image path when dressed (optional) */
  imagePath?: string | null
  createdAt: string
  updatedAt: string
}

export function parseCharacterCostumes(
  json: string | null | undefined
): CharacterCostumeEntry[] {
  if (!json?.trim()) return []
  try {
    const arr = JSON.parse(json) as unknown
    if (!Array.isArray(arr)) return []
    const out: CharacterCostumeEntry[] = []
    for (const raw of arr) {
      if (!raw || typeof raw !== 'object') continue
      const o = raw as Record<string, unknown>
      const description =
        typeof o.description === 'string' ? o.description.trim() : ''
      if (!description) continue
      const name =
        typeof o.name === 'string' && o.name.trim()
          ? o.name.trim()
          : description.slice(0, 32)
      const now = new Date().toISOString()
      out.push({
        id:
          typeof o.id === 'string' && o.id
            ? o.id
            : `cos_${out.length}_${Date.now()}`,
        name,
        description,
        artStyle:
          typeof o.artStyle === 'string' && o.artStyle.trim()
            ? o.artStyle.trim()
            : null,
        imagePath:
          typeof o.imagePath === 'string' && o.imagePath
            ? o.imagePath
            : null,
        createdAt:
          typeof o.createdAt === 'string' ? o.createdAt : now,
        updatedAt:
          typeof o.updatedAt === 'string' ? o.updatedAt : now
      })
    }
    return out
  } catch {
    return []
  }
}

export function serializeCharacterCostumes(
  items: CharacterCostumeEntry[]
): string {
  return JSON.stringify(items)
}

export function createCostumeEntry(input: {
  name?: string
  description: string
  artStyle?: string | null
  imagePath?: string | null
}): CharacterCostumeEntry {
  const description = input.description.trim()
  if (!description) {
    throw new Error('Costume description is required')
  }
  const now = new Date().toISOString()
  return {
    id: `cos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: (input.name?.trim() || description.slice(0, 32)).trim(),
    description,
    artStyle: input.artStyle?.trim() || null,
    imagePath: input.imagePath ?? null,
    createdAt: now,
    updatedAt: now
  }
}

export function upsertCostume(
  items: CharacterCostumeEntry[],
  entry: CharacterCostumeEntry
): CharacterCostumeEntry[] {
  const i = items.findIndex((x) => x.id === entry.id)
  if (i < 0) return [entry, ...items]
  const next = items.slice()
  next[i] = { ...entry, updatedAt: new Date().toISOString() }
  return next
}

export function removeCostume(
  items: CharacterCostumeEntry[],
  id: string
): CharacterCostumeEntry[] {
  return items.filter((x) => x.id !== id)
}

export function findCostumeByDescription(
  items: CharacterCostumeEntry[],
  description: string
): CharacterCostumeEntry | null {
  const d = description.trim().toLowerCase()
  if (!d) return null
  return (
    items.find((x) => x.description.trim().toLowerCase() === d) ?? null
  )
}

/**
 * When saving a character with a free-text costume, ensure the library
 * has a matching entry (by description) or create one named "Default".
 */
export function ensureCostumeInLibrary(
  items: CharacterCostumeEntry[],
  costumeText: string | null | undefined,
  opts?: { name?: string; artStyle?: string | null }
): CharacterCostumeEntry[] {
  const description = costumeText?.trim()
  if (!description) return items
  const existing = findCostumeByDescription(items, description)
  if (existing) {
    if (opts?.artStyle && !existing.artStyle) {
      return upsertCostume(items, {
        ...existing,
        artStyle: opts.artStyle,
        updatedAt: new Date().toISOString()
      })
    }
    return items
  }
  return [
    createCostumeEntry({
      name: opts?.name ?? 'Default',
      description,
      artStyle: opts?.artStyle
    }),
    ...items
  ]
}
