/**
 * Policy: only feed the model what the user actually provided.
 * - If idea / form / extras are rich → follow them.
 * - If sparse or empty → let the model invent freely to complete the task.
 * - Never seed content from unprovided sources (e.g. active story style
 *   when inventing a standalone character).
 *
 * No hard-coded theme bans (no “never rain”, no “never Demo”) — those overfit
 * one bug and fail on the next unrelated default.
 */

export interface StoryContextInjectFlags {
  /** Form already has filled fields (refine / polish) */
  hasDraft?: boolean
  /** Linked soul / extra identity bible */
  hasSoul?: boolean
  /** Explicit “suggest next beat from story” actions */
  suggestFromStory?: boolean
}

/**
 * For scenes / props / wardrobe-style continuity: inject story only when
 * refining existing work or the user explicitly asked “from story”.
 */
export function shouldInjectStoryContext(
  flags: StoryContextInjectFlags
): boolean {
  return Boolean(flags.hasDraft || flags.hasSoul || flags.suggestFromStory)
}

/**
 * Character profile invent/refine is about the person, not the open story’s
 * production bible. Story continuity belongs in scene / clip / wardrobe flows.
 */
export function shouldInjectStoryContextForCharacter(): boolean {
  return false
}

/**
 * Principle-based invent rules for master system prompts (any domain).
 * No theme blacklists — only “use what’s given; invent the rest if missing”.
 */
export function inventFromProvidedSourcesRules(
  locale: 'zh-HK' | 'en' = 'zh-HK'
): string[] {
  if (locale === 'en') {
    return [
      'Sources of truth, in order: (1) user idea / request, (2) filled form fields, (3) linked extras (soul, cast lists, etc.) when provided.',
      'Use ALL provided sources. If a field or idea is missing or thin, invent freely to complete a filmable result — do not leave critical keys empty when inventing.',
      'Do NOT pull identity, plot, weather, job, location, or style from sources that were not provided in this request (e.g. an active story title/style that is not in the prompt).',
      'When story/style context IS included below, treat it as optional production continuity — follow it only where it helps consistency; never override an explicit user idea.'
    ]
  }
  return [
    '依據來源（優先序）：（1）用戶 idea／指示，（2）已填表單，（3）已提供的額外上下文（soul、選角列表等）。',
    '凡已提供的內容均須使用。若 idea 或欄位空白／不足，請自由補齊可拍攝內容——創作時勿將關鍵欄位留空。',
    '不得從「本次請求未提供」的來源臆造身份、劇情、天氣、職業、地點或風格（例如 prompt 中未出現的故事標題／風格）。',
    '若下方附有故事／風格：僅作可選 continuity；有助一致時採用，但不可覆蓋用戶明確 idea。'
  ]
}

/** @deprecated Use inventFromProvidedSourcesRules — kept as alias for call sites. */
export function antiDefaultIdentityRules(
  locale: 'zh-HK' | 'en' = 'zh-HK'
): string[] {
  return inventFromProvidedSourcesRules(locale)
}
