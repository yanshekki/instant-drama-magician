/**
 * Generate a soul.md (single_md style) from InstantDrama character profile fields.
 * Compatible with SoulMD Hub catalog structure for local use.
 */

import { PromptCatalog } from '../prompts'
import type { CharacterProfileFields } from '../types/domain'

export type SoulProfileInput = Partial<CharacterProfileFields> & {
  name?: string
}

export function buildSoulGenerateSystemPrompt(locale: string = 'zh-HK'): string {
  return PromptCatalog.t(locale, 'soul.system')
}

export function buildSoulGenerateUserPrompt(options: {
  profile: SoulProfileInput
  locale?: string
  storyTitle?: string
  styleNote?: string | null
  /** Existing soul.md to improve / merge */
  existingSoul?: string | null
  userRequest?: string | null
}): string {
  const loc = options.locale || 'zh-HK'
  const p = options.profile
  const lines: string[] = []
  const hasExisting = Boolean(options.existingSoul?.trim())
  lines.push(
    hasExisting
      ? PromptCatalog.t(loc, 'soul.improveMode')
      : PromptCatalog.t(loc, 'soul.createMode')
  )
  lines.push('')
  lines.push(PromptCatalog.t(loc, 'soul.profileFields'))
  lines.push('```json')
  lines.push(
    JSON.stringify(
      {
        name: p.name ?? '',
        description: p.description ?? '',
        appearance: p.appearance ?? '',
        costume: p.costume ?? '',
        personality: p.personality ?? '',
        backstory: p.backstory ?? '',
        ageRange: p.ageRange ?? '',
        gender: p.gender ?? '',
        voiceDesc: p.voiceDesc ?? '',
        spokenLanguages: p.spokenLanguages ?? [],
        mannerisms: p.mannerisms ?? '',
        relationships: p.relationships ?? '',
        visualTags: p.visualTags ?? ''
      },
      null,
      2
    )
  )
  lines.push('```')
  if (hasExisting) {
    const soul = options.existingSoul!.trim()
    const body =
      soul.length > 12_000
        ? `${soul.slice(0, 12_000)}\n\n…[truncated]`
        : soul
    lines.push('')
    lines.push(PromptCatalog.t(loc, 'soul.existing'))
    lines.push(body)
  }
  if (options.userRequest?.trim()) {
    lines.push('')
    lines.push(
      PromptCatalog.t(loc, 'soul.userRequest', {
        request: options.userRequest.trim()
      })
    )
  }
  if (options.storyTitle?.trim() || options.styleNote?.trim()) {
    lines.push('')
    lines.push(PromptCatalog.t(loc, 'soul.extraContext'))
    if (options.storyTitle?.trim()) {
      lines.push(
        PromptCatalog.t(loc, 'improve.storyTitle', {
          title: options.storyTitle.trim()
        })
      )
    }
    if (options.styleNote?.trim()) {
      lines.push(
        PromptCatalog.t(loc, 'improve.styleNote', {
          style: options.styleNote.trim()
        })
      )
    }
  }
  lines.push(PromptCatalog.t(loc, 'soul.returnOnly'))
  return lines.join('\n')
}

/** Strip accidental ``` fences around the model output. */
export function normalizeSoulMarkdown(raw: string): string {
  let s = raw.trim()
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:markdown|md)?\s*/i, '')
    s = s.replace(/\s*```\s*$/i, '')
  }
  return s.trim()
}

export function profileHasSoulSource(profile: SoulProfileInput): boolean {
  return Boolean(
    profile.name?.trim() ||
      profile.description?.trim() ||
      profile.appearance?.trim() ||
      profile.personality?.trim() ||
      profile.costume?.trim() ||
      profile.backstory?.trim()
  )
}
