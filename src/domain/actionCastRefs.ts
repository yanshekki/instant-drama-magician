/**
 * Cross-library references for Action motion plates
 * (characters / costumes / scenes / props stills).
 */

export type ActionCastEntityType =
  | 'character'
  | 'costume'
  | 'scene'
  | 'prop'

export interface ActionCastRef {
  id: string
  entityType: ActionCastEntityType
  entityId: string
  entityName?: string
  imagePath: string
  /** e.g. lead actor, moved prop */
  roleHint?: string
}

const TYPES = new Set<ActionCastEntityType>([
  'character',
  'costume',
  'scene',
  'prop'
])

export function parseActionCastRefs(
  json: string | null | undefined
): ActionCastRef[] {
  if (!json?.trim()) return []
  try {
    const arr = JSON.parse(json) as unknown
    if (!Array.isArray(arr)) return []
    const out: ActionCastRef[] = []
    for (const raw of arr) {
      if (!raw || typeof raw !== 'object') continue
      const o = raw as Record<string, unknown>
      const entityType = o.entityType as ActionCastEntityType
      const entityId = typeof o.entityId === 'string' ? o.entityId.trim() : ''
      const imagePath = typeof o.imagePath === 'string' ? o.imagePath.trim() : ''
      if (!TYPES.has(entityType) || !entityId || !imagePath) continue
      out.push({
        id:
          typeof o.id === 'string' && o.id
            ? o.id
            : `aref_${out.length}_${Date.now()}`,
        entityType,
        entityId,
        imagePath,
        ...(typeof o.entityName === 'string' && o.entityName.trim()
          ? { entityName: o.entityName.trim() }
          : {}),
        ...(typeof o.roleHint === 'string' && o.roleHint.trim()
          ? { roleHint: o.roleHint.trim() }
          : {})
      })
    }
    return out
  } catch {
    return []
  }
}

export function serializeActionCastRefs(refs: ActionCastRef[]): string {
  return JSON.stringify(refs)
}

export function makeActionCastRefId(): string {
  return `aref_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** Binding / prompt order: lead identity before wardrobe, place, props. */
const BINDING_TYPE_ORDER: ActionCastEntityType[] = [
  'character',
  'costume',
  'scene',
  'prop'
]

/** Stable order for SUBJECT BINDING blocks and edit-base priority scans. */
export function orderCastRefsForBinding(refs: ActionCastRef[]): ActionCastRef[] {
  return [...refs].sort(
    (a, b) =>
      BINDING_TYPE_ORDER.indexOf(a.entityType) -
      BINDING_TYPE_ORDER.indexOf(b.entityType)
  )
}

/**
 * Prefer character still, then costume, then any cast still.
 * Does not check filesystem — caller filters with existsSync.
 */
export function pickPrimaryCastStill(
  refs: ActionCastRef[]
): string | null {
  const ordered = orderCastRefsForBinding(refs)
  for (const type of BINDING_TYPE_ORDER) {
    const hit = ordered.find(
      (r) => r.entityType === type && r.imagePath?.trim()
    )
    if (hit?.imagePath?.trim()) return hit.imagePath.trim()
  }
  for (const r of ordered) {
    const p = r.imagePath?.trim()
    if (p) return p
  }
  return null
}
