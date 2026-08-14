/**
 * Shared “AI improve” user-prompt structure for all master-prompt fill buttons.
 * Always merge full form draft (+ optional extra context) so generate = refine.
 * Labels come from PromptCatalog (10 languages) — no en/zh pair objects.
 */

import { PromptCatalog } from '../prompts'
import type { PromptCopyKey } from '../prompts/copy/keys'

export function draftHasContent(
  draft: Record<string, unknown> | null | undefined
): boolean {
  if (!draft) return false
  return Object.values(draft).some((v) => {
    if (typeof v === 'string') return v.trim().length > 0
    if (Array.isArray(v)) return v.length > 0
    if (v != null && typeof v === 'object') {
      return Object.keys(v as object).length > 0
    }
    return v != null && String(v).trim().length > 0
  })
}

/** Compact object with only non-empty values (for JSON in prompts). */
export function compactDraft<T extends Record<string, unknown>>(
  draft: T
): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(draft)) {
    if (typeof v === 'string') {
      if (v.trim()) out[k] = v.trim()
    } else if (Array.isArray(v)) {
      if (v.length > 0) out[k] = v
    } else if (v != null && v !== '') {
      out[k] = v
    }
  }
  return out as Partial<T>
}

export function truncateForPrompt(text: string, max = 12_000): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}\n\n…[truncated for length]`
}

export interface ImprovePromptParts {
  locale?: string
  /** Short user instruction / idea box */
  idea: string
  draftLabelKey?: PromptCopyKey
  /** Literal label override (tests / one-off). */
  draftLabel?: string
  draft?: Record<string, unknown> | null
  extraBlocks?: Array<{
    labelKey?: PromptCopyKey
    label?: string
    body: string
  }>
  storyTitle?: string
  styleNote?: string | null
  closingKey?: PromptCopyKey
  closing?: string
  emptyIdeaPolishKey?: PromptCopyKey
  emptyIdeaPolish?: string
  createLabelKey?: PromptCopyKey
  createLabel?: string
}

function catalogOr(
  locale: string,
  explicit: string | undefined,
  key: PromptCopyKey,
  vars?: Record<string, string>
): string {
  return explicit ?? PromptCatalog.t(locale, key, vars)
}

/**
 * Build unified improve / create user prompt used by character, scene, prop, story AI.
 */
export function buildImproveUserPrompt(parts: ImprovePromptParts): string {
  const loc = parts.locale || 'zh-HK'
  const lines: string[] = []
  const draft = parts.draft ? compactDraft(parts.draft) : {}
  const hasDraft = draftHasContent(draft)
  const extras = (parts.extraBlocks ?? []).filter((b) => b.body.trim())
  const hasExtras = extras.length > 0
  const idea = parts.idea.trim()

  if (hasDraft || hasExtras) {
    lines.push(PromptCatalog.t(loc, 'improve.mode'))
    lines.push('')
    if (hasDraft) {
      lines.push(
        catalogOr(loc, parts.draftLabel, parts.draftLabelKey ?? 'improve.draftDefault')
      )
      lines.push(JSON.stringify(draft, null, 2))
      lines.push('')
    }
    for (const block of extras) {
      const heading =
        block.label ??
        (block.labelKey ? PromptCatalog.t(loc, block.labelKey) : '')
      if (heading) lines.push(heading)
      lines.push(truncateForPrompt(block.body))
      lines.push('')
    }
    lines.push(PromptCatalog.t(loc, 'improve.userRequest'))
    lines.push(
      idea ||
        catalogOr(
          loc,
          parts.emptyIdeaPolish,
          parts.emptyIdeaPolishKey ?? 'improve.emptyDefault'
        )
    )
  } else {
    lines.push(
      catalogOr(
        loc,
        parts.createLabel,
        parts.createLabelKey ?? 'improve.createDefault'
      )
    )
    lines.push(idea)
  }

  lines.push('')
  const hasStory = Boolean(parts.storyTitle?.trim())
  const hasStyle = Boolean(parts.styleNote?.trim())
  if (hasStory || hasStyle) {
    lines.push(PromptCatalog.t(loc, 'improve.explicitContext'))
    if (hasStory) {
      lines.push(
        PromptCatalog.t(loc, 'improve.storyTitle', {
          title: parts.storyTitle!.trim()
        })
      )
    }
    if (hasStyle) {
      lines.push(
        PromptCatalog.t(loc, 'improve.styleNote', {
          style: parts.styleNote!.trim()
        })
      )
    }
  }
  lines.push(
    catalogOr(loc, parts.closing, parts.closingKey ?? 'improve.closingDefault')
  )
  return lines.join('\n')
}
