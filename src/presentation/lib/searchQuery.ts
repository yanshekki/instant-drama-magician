/**
 * Multi-keyword search helpers.
 * Split on whitespace, |, fullwidth |, and Chinese/ASCII commas.
 * All tokens must match (AND).
 */

/** Split user query into non-empty lowercase tokens. */
export function splitSearchTokens(query: string): string[] {
  const raw = (query ?? '').trim()
  if (!raw) return []
  return raw
    .toLowerCase()
    .split(/[\s|｜,，、]+/u)
    .map((t) => t.trim())
    .filter(Boolean)
}

/**
 * True when every search token appears in haystack (case-insensitive).
 * Empty query → always true.
 */
export function matchesSearchQuery(haystack: string, query: string): boolean {
  const tokens = splitSearchTokens(query)
  if (tokens.length === 0) return true
  const hay = (haystack ?? '').toLowerCase()
  return tokens.every((tok) => hay.includes(tok))
}
