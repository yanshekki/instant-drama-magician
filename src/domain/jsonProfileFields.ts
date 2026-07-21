import { AppError } from '../types/errors'
/**
 * Shared helpers for LLM profile JSON: extract object + coerce string fields.
 * Models often return visualTags as string[] — must not drop those as "empty".
 */

/** Coerce LLM JSON values into a single trimmed string (or undefined). */
export function coerceProfileString(value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value === 'string') {
    const t = value.trim()
    return t.length > 0 ? t : undefined
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    const t = String(value).trim()
    return t.length > 0 ? t : undefined
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((x) => {
        if (typeof x === 'string') return x.trim()
        if (typeof x === 'number' || typeof x === 'boolean') return String(x)
        return ''
      })
      .filter((s) => s.length > 0)
    if (parts.length === 0) return undefined
    return parts.join(', ')
  }
  // Nested object e.g. { en: "gold, heart" } or { tags: [...] }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>
    for (const k of [
      'en',
      'zh',
      'tags',
      'value',
      'text',
      'visualTags',
      'list'
    ]) {
      const s = coerceProfileString(o[k])
      if (s) return s
    }
    const vals = Object.values(o)
      .map((v) => coerceProfileString(v))
      .filter((s): s is string => Boolean(s))
    if (vals.length > 0) return vals.join(', ')
  }
  return undefined
}

/** First non-empty coerce among alias keys (e.g. visualTags | visual_tags | tags). */
export function coerceProfileStringFrom(
  obj: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const k of keys) {
    if (!(k in obj)) continue
    const s = coerceProfileString(obj[k])
    if (s) return s
  }
  // Case-insensitive key match (VisualTags, VISUALTAGS, …)
  const lowerMap = new Map(
    Object.keys(obj).map((k) => [k.toLowerCase(), k] as const)
  )
  for (const k of keys) {
    const real = lowerMap.get(k.toLowerCase())
    if (!real) continue
    const s = coerceProfileString(obj[real])
    if (s) return s
  }
  return undefined
}

/**
 * Extract first JSON object from model text (tolerates ```json fences).
 * Throws if no object found or JSON.parse fails.
 */
export function extractJsonObject(text: string): Record<string, unknown> {
  let raw = (text ?? '').trim()
  if (!raw) throw new AppError('VALIDATION', 'errors.noJsonInModelResponse')
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) raw = fenced[1].trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new AppError('VALIDATION', 'errors.noJsonInModelResponse')
  }
  const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AppError('VALIDATION', 'errors.noJsonInModelResponse')
  }
  return parsed as Record<string, unknown>
}

/** Standard aliases for visual tag fields (EN + zh keys models invent). */
export const VISUAL_TAGS_KEYS = [
  'visualTags',
  'visual_tags',
  'tags',
  'visualTag',
  'visual_tag',
  'keywords',
  'imageTags',
  'image_tags',
  '視覺標籤',
  '标签',
  '標籤'
] as const

/**
 * Last-resort English comma tags from free text (name/description/material).
 * Keeps short tokens only — never empty when any source text exists.
 */
export function synthesizeVisualTagsFromText(
  parts: Array<string | null | undefined>
): string | undefined {
  const blob = parts
    .map((p) => (typeof p === 'string' ? p : ''))
    .join(' ')
    .toLowerCase()
  if (!blob.trim()) return undefined
  // Prefer latin tokens for image models
  const en = blob.match(/[a-z][a-z0-9-]{1,20}/g) ?? []
  const stop = new Set([
    'the',
    'and',
    'with',
    'from',
    'for',
    'this',
    'that',
    'prop',
    'item',
    'object',
    'look',
    'style',
    'very',
    'more',
    'than'
  ])
  const uniq: string[] = []
  for (const w of en) {
    if (stop.has(w)) continue
    if (!uniq.includes(w)) uniq.push(w)
    if (uniq.length >= 10) break
  }
  if (uniq.length > 0) return uniq.join(', ')
  // CJK fallback: keep short chunks from description
  const cjk = blob.replace(/\s+/g, ' ').trim().slice(0, 48)
  return cjk || undefined
}

/**
 * Shared instruction lines: every listed key must be present as a non-empty string.
 * visualTags must be a comma-separated English string, never a JSON array.
 */
export function profileCompletenessRules(
  keys: readonly string[],
  locale: 'zh-HK' | 'en'
): string[] {
  const list = keys.join(', ')
  if (locale === 'en') {
    return [
      `You MUST output EVERY key in this list: ${list}.`,
      'Every value MUST be a JSON string (not null, not a JSON array). Empty string only if truly unknown.',
      'visualTags: single English comma-separated string, e.g. "gold, necklace, jewelry" — NEVER ["gold","necklace"].',
      'Prefer filling all keys with concrete detail for short-drama continuity.'
    ]
  }
  return [
    `必須輸出列表中的每一個鍵：${list}。`,
    '每個值必須是 JSON 字串（不可 null、不可用 JSON 陣列）。真的不知道才可空字串。',
    'visualTags：單一英文逗號分隔字串，例如 "gold, necklace, jewelry"——禁止 ["gold","necklace"] 陣列。',
    '各鍵請盡量填具體細節，利於短劇 continuity。'
  ]
}
