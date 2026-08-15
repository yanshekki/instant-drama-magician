import {
  PromptCatalog,
  packHardRulesFallback,
  packHardRulesInstruction
} from '../prompts'
import {
  buildSpeechLanguageLockText,
  mergeSpeechLockIntoHardRules
} from './speechLanguageLock'
import { UI_LANGUAGES } from './uiLanguages'

/**
 * High-priority user hard rules (必須 / 禁止) for image & video generation.
 * Inlined into the single prompt string — image/video APIs have no separate
 * negative-prompt channel.
 */

/** Legacy English seal — still recognized when stripping old drafts. */
export const HARD_RULES_HEADER =
  'HARD RULES (highest priority — must obey; override any conflicting earlier details):'

export const HARD_RULES_FOOTER =
  'If any earlier instruction conflicts with HARD RULES, follow HARD RULES.'

export function hardRulesSealHeader(locale?: string | null): string {
  return PromptCatalog.t(locale || 'zh-HK', 'hardRules.sealHeader')
}

export function hardRulesSealFooter(locale?: string | null): string {
  return PromptCatalog.t(locale || 'zh-HK', 'hardRules.sealFooter')
}

export function allHardRulesHeaders(): string[] {
  const out = new Set<string>([HARD_RULES_HEADER])
  for (const lang of UI_LANGUAGES) {
    const h = PromptCatalog.t(lang.id, 'hardRules.sealHeader').trim()
    if (h) out.add(h)
  }
  return [...out]
}

function firstHardRulesHeaderIndex(prompt: string): number {
  let earliest = -1
  for (const h of allHardRulesHeaders()) {
    if (!h) continue
    const i = prompt.indexOf(h)
    if (i >= 0 && (earliest < 0 || i < earliest)) earliest = i
  }
  return earliest
}

export function promptHasHardRulesHeader(prompt: string): boolean {
  return firstHardRulesHeaderIndex(prompt) >= 0
}

/** Normalize / cap user hard-rules text. Empty → null. */
export function normalizeHardRules(
  raw: string | null | undefined,
  maxLen = 2000
): string | null {
  if (raw == null) return null
  let s = String(raw).trim()
  if (!s) return null
  if (s.length > maxLen) s = s.slice(0, maxLen).trim()
  return s || null
}

/** Format the HARD RULES block (no surrounding blank lines). */
export function hardRulesBlock(
  hardRules: string,
  locale?: string | null
): string {
  const body = hardRules.trim()
  if (!body) return ''
  return [
    hardRulesSealHeader(locale),
    body,
    hardRulesSealFooter(locale)
  ].join('\n')
}

/**
 * Append hard rules at the end of a prompt (models weight late “must obey” well).
 * If rules already present as a block, still re-append a clean block only when
 * `force` is true — default: skip if prompt already ends with HARD RULES header.
 */
export function appendHardRules(
  prompt: string,
  hardRules?: string | null,
  opts?: { force?: boolean; locale?: string | null }
): string {
  const rules = normalizeHardRules(hardRules)
  if (!rules) return prompt
  const locale = opts?.locale ?? 'zh-HK'
  const base = String(prompt ?? '').trimEnd()
  if (!base) return hardRulesBlock(rules, locale)
  if (!opts?.force && promptHasHardRulesHeader(base)) {
    // Already injected (e.g. builder + handler) — avoid duplicate walls of text
    return base
  }
  return `${base}\n\n${hardRulesBlock(rules, locale)}`
}

/**
 * Ensure hard rules appear at the end even if the user edited promptOverride
 * and removed them. Always force re-append after stripping prior HARD RULES blocks.
 */
export function ensureHardRules(
  prompt: string,
  hardRules?: string | null,
  locale?: string | null
): string {
  const rules = normalizeHardRules(hardRules)
  if (!rules) return prompt
  const stripped = stripHardRulesBlocks(String(prompt ?? ''))
  return appendHardRules(stripped, rules, { force: true, locale })
}

/** Remove previous HARD RULES sections (best-effort). */
export function stripHardRulesBlocks(prompt: string): string {
  const i = firstHardRulesHeaderIndex(prompt)
  if (i < 0) return prompt
  return prompt.slice(0, i).trimEnd()
}

/** Merge multiple hard-rules sources (story + cast assets); de-dupe lines. */
export function mergeHardRules(
  ...parts: Array<string | null | undefined>
): string | null {
  const lines = new Set<string>()
  for (const p of parts) {
    const n = normalizeHardRules(p)
    if (!n) continue
    for (const line of n.split(/\r?\n/)) {
      const t = line.trim()
      if (t) lines.add(t)
    }
  }
  if (lines.size === 0) return null
  return normalizeHardRules([...lines].join('\n'))
}

/**
 * Instruction block for AI profile / meta fill: hardRules MUST be non-empty.
 */
export function hardRulesAiInstruction(locale: string = 'zh-HK'): string {
  return packHardRulesInstruction(locale)
}

/** Fallback when model forgets hardRules (still better than empty). */
export function defaultHardRulesFallback(
  kind: 'story' | 'character' | 'scene' | 'prop' | 'action' | 'costume',
  locale: string = 'zh-HK'
): string {
  return packHardRulesFallback(kind, locale)
}

export type TimelineHardRulesSources = {
  story?: { hardRules?: string | null; title?: string | null } | null
  characters?: Array<{
    hardRules?: string | null
    name?: string | null
    spokenLanguages?: string | string[] | null
  } | null> | null
  scenes?: Array<{
    hardRules?: string | null
    title?: string | null
    description?: string | null
  } | null> | null
  props?: Array<{
    hardRules?: string | null
    name?: string | null
  } | null> | null
  actions?: Array<{
    hardRules?: string | null
    name?: string | null
  } | null> | null
}

/**
 * Merge hard rules from story + assets bound on a timeline clip.
 * Default: label each source so the video model knows which object the rule targets
 * (e.g. `[角色 · Keith]` vs `[場景 · 屋頂]`).
 */
export function collectTimelineHardRules(
  sources: TimelineHardRulesSources,
  opts?: { labelObjects?: boolean; uiLocale?: string | null }
): string | null {
  const labelObjects = opts?.labelObjects !== false
  const loc = opts?.uiLocale ?? 'zh-HK'
  const storyL = PromptCatalog.t(loc, 'hardRules.labelStory')
  const charL = PromptCatalog.t(loc, 'hardRules.labelCharacter')
  const sceneL = PromptCatalog.t(loc, 'hardRules.labelScene')
  const propL = PromptCatalog.t(loc, 'hardRules.labelProp')
  const actionL = PromptCatalog.t(loc, 'hardRules.labelAction')
  const speechLock = buildSpeechLanguageLockText({
    characters: (sources.characters ?? []).filter(
      (c): c is NonNullable<typeof c> => c != null
    ),
    uiLocale: loc,
    locale: loc
  })
  if (!labelObjects) {
    const parts: Array<string | null | undefined> = []
    if (sources.story?.hardRules) parts.push(sources.story.hardRules)
    for (const list of [
      sources.characters,
      sources.scenes,
      sources.props,
      sources.actions
    ]) {
      if (!list) continue
      for (const item of list) {
        if (item?.hardRules) parts.push(item.hardRules)
      }
    }
    return mergeSpeechLockIntoHardRules(mergeHardRules(...parts), speechLock)
  }

  const sections: string[] = []
  const pushSection = (label: string, rules?: string | null): void => {
    const n = normalizeHardRules(rules)
    if (!n) return
    sections.push(`[${label}]\n${n}`)
  }

  if (sources.story?.hardRules) {
    const st = sources.story.title?.trim()
    pushSection(st ? `${storyL} · ${st}` : storyL, sources.story.hardRules)
  }
  for (const c of sources.characters ?? []) {
    if (!c?.hardRules) continue
    const name = c.name?.trim() || charL
    pushSection(`${charL} · ${name}`, c.hardRules)
  }
  for (const s of sources.scenes ?? []) {
    if (!s?.hardRules) continue
    const name =
      s.title?.trim() ||
      (s.description ? String(s.description).slice(0, 32).trim() : '') ||
      sceneL
    pushSection(`${sceneL} · ${name}`, s.hardRules)
  }
  for (const p of sources.props ?? []) {
    if (!p?.hardRules) continue
    const name = p.name?.trim() || propL
    pushSection(`${propL} · ${name}`, p.hardRules)
  }
  for (const a of sources.actions ?? []) {
    if (!a?.hardRules) continue
    const name = a.name?.trim() || actionL
    pushSection(`${actionL} · ${name}`, a.hardRules)
  }

  const merged = sections.length
    ? normalizeHardRules(sections.join('\n\n'), 4000)
    : null
  return mergeSpeechLockIntoHardRules(merged, speechLock)
}
