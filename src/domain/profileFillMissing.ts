/**
 * Second-pass LLM fill: only keys still empty after the main AI profile fill.
 */
import type { ChatCompletionRequest, ChatCompletionResponse } from '../types/domain'
import { chatContentText } from '../types/domain'
import { buildVisionUserContent } from './chatVision'
import {
  coerceProfileString,
  coerceProfileStringFrom,
  extractJsonObject,
  synthesizeVisualTagsFromText,
  VISUAL_TAGS_KEYS
} from './jsonProfileFields'

export type ProfileChatFn = (
  request: ChatCompletionRequest
) => Promise<ChatCompletionResponse>

export function isProfileFieldEmpty(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'number' || typeof value === 'boolean') return false
  return true
}

/** Keys that are still empty / missing on the profile. */
export function listMissingProfileKeys(
  profile: Record<string, unknown>,
  requiredKeys: readonly string[]
): string[] {
  return requiredKeys.filter((k) => isProfileFieldEmpty(profile[k]))
}

/**
 * Merge patch into base: only overwrite keys that were empty on base
 * (and are listed in onlyKeys).
 */
export function mergeProfilePatch(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
  onlyKeys: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base }
  for (const k of onlyKeys) {
    if (!isProfileFieldEmpty(out[k])) continue
    let next: string | undefined
    if (k === 'visualTags') {
      next = coerceProfileStringFrom(patch, [...VISUAL_TAGS_KEYS])
    } else {
      next = coerceProfileString(patch[k])
    }
    if (next) out[k] = next
  }
  return out
}

export function buildFillMissingSystemPrompt(
  locale: 'zh-HK' | 'en',
  missingKeys: readonly string[]
): string {
  const keys = missingKeys.join(', ')
  if (locale === 'en') {
    return [
      'You complete short-drama asset profile fields that were left empty.',
      `Return ONLY one JSON object with EXACTLY these keys (and no others): ${keys}.`,
      'Each value MUST be a non-empty JSON string (never null, never a JSON array).',
      'visualTags (if present): English comma-separated string (format example only: "gold, necklace") — NEVER an array; invent tags that match THIS asset, do not copy the example.',
      'Stay consistent with the partial profile and any attached reference image only — do not invent a different plot, location, or sample world not already implied by the partial/image.',
      'No markdown fences, no commentary.'
    ].join('\n')
  }
  return [
    '你負責補齊短劇資產設定中「仍然空白」的欄位。',
    `只回傳一個 JSON 物件，且只能包含這些鍵：${keys}。`,
    '每個值必須是非空 JSON 字串（不可 null、不可 JSON 陣列）。',
    '若含 visualTags：英文逗號分隔字串（格式例："gold, necklace"，勿照抄例子，須貼合本資產）——禁止陣列。',
    '只根據已有部分設定及參考圖補齊；勿另起未見於 partial／圖的劇情、地點或樣本世界。',
    '不要 markdown、不要解說。'
  ].join('\n')
}

export function buildFillMissingUserPrompt(
  locale: 'zh-HK' | 'en',
  partialProfile: Record<string, unknown>,
  missingKeys: readonly string[]
): string {
  const keys = missingKeys.join(', ')
  if (locale === 'en') {
    return [
      'Partial profile (already filled — do not contradict):',
      JSON.stringify(partialProfile, null, 2),
      '',
      `Fill ONLY these missing keys: ${keys}.`,
      'Return JSON with those keys only; every value a non-empty string.'
    ].join('\n')
  }
  return [
    '已有部分設定（勿矛盾）：',
    JSON.stringify(partialProfile, null, 2),
    '',
    `只補齊這些空白鍵：${keys}。`,
    '只回傳含上述鍵的 JSON；每值為非空字串。'
  ].join('\n')
}

/**
 * If profile still has empty keys among requiredKeys, run a focused LLM pass
 * to fill only those keys (optionally with vision). Returns merged profile.
 * Chat failures never throw — main fill still returns.
 */
export async function fillMissingProfileFields<
  T extends Record<string, unknown>
>(options: {
  profile: T
  requiredKeys: readonly string[]
  locale: 'zh-HK' | 'en'
  chat: ProfileChatFn
  referenceImagePath?: string | null
  maxTokens?: number
}): Promise<{ profile: T; patchedKeys: string[]; raw?: string }> {
  let profile = { ...options.profile } as T
  const missing = listMissingProfileKeys(profile, options.requiredKeys)
  if (missing.length === 0) {
    return { profile, patchedKeys: [] }
  }

  const textPrompt = buildFillMissingUserPrompt(
    options.locale,
    profile,
    missing
  )
  let raw: string | undefined
  let patch: Record<string, unknown> = {}
  try {
    const completion = await options.chat({
      messages: [
        {
          role: 'system',
          content: buildFillMissingSystemPrompt(options.locale, missing)
        },
        {
          role: 'user',
          content: buildVisionUserContent(
            textPrompt,
            options.referenceImagePath ?? null
          )
        }
      ],
      max_tokens: options.maxTokens ?? 800
    })
    raw = chatContentText(completion.choices[0]?.message.content)
    try {
      patch = extractJsonObject(raw)
    } catch {
      patch = {}
    }
  } catch {
    // Network / gateway error on second pass — still try local fallbacks
    raw = undefined
    patch = {}
  }

  profile = mergeProfilePatch(profile, patch, missing) as T
  let stillMissing = listMissingProfileKeys(profile, missing)
  const patchedKeys = missing.filter((k) => !stillMissing.includes(k))

  // Dedicated visualTags salvage if still empty after LLM patch
  if (stillMissing.includes('visualTags')) {
    const tags = synthesizeVisualTagsFromText([
      coerceProfileString(profile.name),
      coerceProfileString(profile.description),
      coerceProfileString(profile.material),
      coerceProfileString(profile.condition),
      coerceProfileString(profile.title)
    ])
    if (tags) {
      ;(profile as Record<string, unknown>).visualTags = tags
      patchedKeys.push('visualTags')
      stillMissing = stillMissing.filter((k) => k !== 'visualTags')
    }
  }

  return { profile, patchedKeys, raw }
}
