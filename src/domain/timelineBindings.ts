/**
 * Multi-bind helpers for timeline entries (characters / scenes / props).
 * Primary id = first element of the list (also stored on legacy FK columns).
 */

export const MAX_BEAT_CHARACTERS = 4
export const MAX_BEAT_SCENES = 2
export const MAX_BEAT_PROPS = 4

/** Parse JSON id list; if empty, fall back to single legacy id. */
export function parseIdList(
  json: string | null | undefined,
  fallbackId?: string | null
): string[] {
  if (json?.trim()) {
    try {
      const raw = JSON.parse(json) as unknown
      if (Array.isArray(raw)) {
        const ids = raw
          .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
          .map((x) => x.trim())
        // de-dupe preserve order
        const seen = new Set<string>()
        const out: string[] = []
        for (const id of ids) {
          if (seen.has(id)) continue
          seen.add(id)
          out.push(id)
        }
        if (out.length > 0) return out
      }
    } catch {
      /* fall through */
    }
  }
  if (fallbackId?.trim()) return [fallbackId.trim()]
  return []
}

export function serializeIdList(ids: string[] | null | undefined): string | null {
  if (!ids || ids.length === 0) return null
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    const t = id?.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out.length ? JSON.stringify(out) : null
}

export function primaryId(ids: string[] | null | undefined): string | null {
  return ids && ids.length > 0 ? ids[0]! : null
}

export function clampIdList(
  ids: string[],
  max: number
): string[] {
  if (ids.length <= max) return ids
  return ids.slice(0, max)
}

/**
 * Merge multi + legacy single fields into canonical lists + primary FKs.
 * Prefer explicit multi arrays when provided.
 */
export function normalizeBindings(input: {
  characterId?: string | null
  sceneId?: string | null
  propId?: string | null
  characterIds?: string[] | null
  sceneIds?: string[] | null
  propIds?: string[] | null
  /** Existing DB row for partial updates */
  existing?: {
    characterId?: string | null
    sceneId?: string | null
    propId?: string | null
    characterIds?: string | null
    sceneIds?: string | null
    propIds?: string | null
  }
}): {
  characterId: string | null
  sceneId: string | null
  propId: string | null
  characterIds: string | null
  sceneIds: string | null
  propIds: string | null
  characterIdList: string[]
  sceneIdList: string[]
  propIdList: string[]
} {
  const ex = input.existing
  const charList = clampIdList(
    input.characterIds !== undefined && input.characterIds !== null
      ? input.characterIds
      : input.characterId !== undefined
        ? input.characterId
          ? [input.characterId]
          : []
        : parseIdList(ex?.characterIds, ex?.characterId),
    MAX_BEAT_CHARACTERS
  )
  const sceneList = clampIdList(
    input.sceneIds !== undefined && input.sceneIds !== null
      ? input.sceneIds
      : input.sceneId !== undefined
        ? input.sceneId
          ? [input.sceneId]
          : []
        : parseIdList(ex?.sceneIds, ex?.sceneId),
    MAX_BEAT_SCENES
  )
  const propList = clampIdList(
    input.propIds !== undefined && input.propIds !== null
      ? input.propIds
      : input.propId !== undefined
        ? input.propId
          ? [input.propId]
          : []
        : parseIdList(ex?.propIds, ex?.propId),
    MAX_BEAT_PROPS
  )

  return {
    characterId: primaryId(charList),
    sceneId: primaryId(sceneList),
    propId: primaryId(propList),
    characterIds: serializeIdList(charList),
    sceneIds: serializeIdList(sceneList),
    propIds: serializeIdList(propList),
    characterIdList: charList,
    sceneIdList: sceneList,
    propIdList: propList
  }
}

/** Map a DB row (or partial) to API TimelineEntry multi fields. */
export function hydrateTimelineBindings<T extends {
  characterId?: string | null
  sceneId?: string | null
  propId?: string | null
  characterIds?: string | null
  sceneIds?: string | null
  propIds?: string | null
}>(
  row: T
): T & {
  characterIds: string[]
  sceneIds: string[]
  propIds: string[]
} {
  return {
    ...row,
    characterIds: parseIdList(row.characterIds, row.characterId),
    sceneIds: parseIdList(row.sceneIds, row.sceneId),
    propIds: parseIdList(row.propIds, row.propId)
  }
}
