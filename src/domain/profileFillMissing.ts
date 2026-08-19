/**
 * Second-pass LLM fill: only keys still empty after the main AI profile fill.
 */
import { PromptCatalog, resolvePromptContext } from '../prompts'
import { assembleSystemPrompt } from './promptTemplates'
import type { ChatCompletionRequest, ChatCompletionResponse } from '../types/domain'
import { chatContentText } from '../types/domain'
import { buildMultiVisionUserContent } from './chatVision'
import { allRefPaths } from './imageGenConfirm'
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
  locale: string,
  missingKeys: readonly string[],
  templateId?: string | null
): string {
  const keys = missingKeys.join(', ')
  return assembleSystemPrompt({
    locale,
    templateId,
    family: 'copy',
    base: [
      PromptCatalog.t(locale, 'fill.system', { keys }),
      resolvePromptContext(locale).outputLock
    ].join('\n')
  })
}

export function buildFillMissingUserPrompt(
  locale: string,
  partialProfile: Record<string, unknown>,
  missingKeys: readonly string[]
): string {
  const keys = missingKeys.join(', ')
  return [
    PromptCatalog.t(locale, 'fill.userPartial'),
    JSON.stringify(partialProfile, null, 2),
    '',
    PromptCatalog.t(locale, 'fill.userOnly', { keys }),
    PromptCatalog.t(locale, 'fill.userReturn')
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
  locale: string
  chat: ProfileChatFn
  referenceImagePath?: string | null
  referenceImagePaths?: string[] | null
  maxTokens?: number
  promptTemplateId?: string | null
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
          content: buildFillMissingSystemPrompt(
            options.locale,
            missing,
            options.promptTemplateId
          )
        },
        {
          role: 'user',
          content: buildMultiVisionUserContent(
            textPrompt,
            allRefPaths(
              options.referenceImagePath ?? null,
              options.referenceImagePaths ?? null
            )
          )
        }
      ],
      max_tokens: options.maxTokens ?? 800,
      timeoutMs: 240_000
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
