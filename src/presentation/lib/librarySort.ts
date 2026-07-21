/**
 * Library list sort helpers — most recently modified first (desc).
 * Handles Date, ISO strings, SQLite/JSON numeric ms (and numeric strings).
 */

/** Coerce entity timestamp fields to epoch ms; 0 if missing/invalid. */
export function parseUpdatedAtMs(value: unknown): number {
  if (value == null || value === '') return 0

  if (typeof value === 'number' && Number.isFinite(value)) {
    // Heuristic: 10-digit → seconds, 13+ → ms
    return value > 0 && value < 1e12 ? Math.round(value * 1000) : value
  }

  // Real Date, or cross-realm Date-like
  if (typeof value === 'object') {
    const maybe = value as { getTime?: () => number }
    if (typeof maybe.getTime === 'function') {
      const t = maybe.getTime()
      return Number.isFinite(t) ? t : 0
    }
  }

  if (typeof value === 'string') {
    const s = value.trim()
    if (!s) return 0
    // Pure numeric (ms or seconds) — new Date("1784…") is Invalid Date
    if (/^\d+(\.\d+)?$/.test(s)) {
      const n = Number(s)
      if (!Number.isFinite(n)) return 0
      return n > 0 && n < 1e12 ? Math.round(n * 1000) : n
    }
    const t = Date.parse(s)
    return Number.isFinite(t) ? t : 0
  }

  return 0
}

function entityTimeMs(entity: unknown): number {
  const e = entity as {
    updatedAt?: unknown
    createdAt?: unknown
  }
  return parseUpdatedAtMs(e.updatedAt) || parseUpdatedAtMs(e.createdAt)
}

/** Sort library cards by most recently modified first (desc). Stable on ties via id. */
export function compareUpdatedAtDesc(a: unknown, b: unknown): number {
  const ta = entityTimeMs(a)
  const tb = entityTimeMs(b)
  if (tb !== ta) return tb - ta
  const ida = String((a as { id?: string }).id ?? '')
  const idb = String((b as { id?: string }).id ?? '')
  if (idb < ida) return -1
  if (idb > ida) return 1
  return 0
}

/** Immutable sort copy — use after API list() so order is correct even without browse. */
export function sortByUpdatedAtDesc<T>(items: readonly T[]): T[] {
  return [...items].sort(compareUpdatedAtDesc)
}
