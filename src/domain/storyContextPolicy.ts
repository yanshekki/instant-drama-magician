/**
 * Policy: only feed the model what the user actually provided.
 *
 * Create: idea / reference image / explicit extras (e.g. soul text).
 * Improve: same + filled form fields — polish & complete; no silent world inject.
 * Suggest-from-story: only when the user explicitly opts in (suggestFromStory).
 *
 * Never seed plot/location/style from unprovided sources (active story, Demo seed,
 * or any fixed sample). No theme blacklists — fix injection contracts instead.
 */

export interface StoryContextInjectFlags {
  /**
   * @deprecated Ignored. Draft means Improve mode (polish form), not “use story”.
   * Kept optional so call sites can pass it without breaking.
   */
  hasDraft?: boolean
  /**
   * @deprecated Ignored for story injection. Soul is passed as explicit text extras.
   */
  hasSoul?: boolean
  /** Explicit “suggest from story / plot segment” user action */
  suggestFromStory?: boolean
}

/**
 * Inject story title / style / cast / scenes into asset AI fill only when the
 * user explicitly asked “from story”. Having a form draft or open activeStory
 * alone must NEVER inject fixed samples.
 */
export function shouldInjectStoryContext(
  flags: StoryContextInjectFlags
): boolean {
  return Boolean(flags.suggestFromStory)
}

/**
 * Character profile invent/refine is about the person, not the open story’s
 * production bible. Story continuity belongs in scene / clip / wardrobe flows.
 */
export function shouldInjectStoryContextForCharacter(): boolean {
  return false
}

/**
 * Principle-based invent + improve rules for master system prompts (any domain).
 * No theme blacklists — only “use what’s given; invent blanks; never silent samples”.
 */
export function inventFromProvidedSourcesRules(
  locale: 'zh-HK' | 'en' = 'zh-HK'
): string[] {
  if (locale === 'en') {
    return [
      'Sources of truth, in order: (1) user idea / request, (2) filled form fields, (3) linked extras (soul, cast lists, story blocks) only when they appear in THIS prompt, (4) attached reference image.',
      'Create mode (thin/empty form): invent freely from the idea/image so every critical key is filmable and related — do not leave required keys empty.',
      'Improve mode (form has content): polish and complete missing fields consistent with the draft; do not replace core identity unless the user asks.',
      'Do NOT import identity, plot, weather, job, location, era, or style from anything not written in this prompt (no active story, no Demo seed, no app default world).',
      'When a story/style block IS present below, use it only for production continuity; never override an explicit user idea.'
    ]
  }
  return [
    '依據來源（優先序）：（1）用戶 idea／指示，（2）已填表單，（3）僅當「本次 prompt 已寫出」的額外上下文（soul、選角、故事區塊等），（4）附上的參考圖。',
    '創作模式（表單空白／極少）：按 idea／圖自由創作，補齊可拍攝的關鍵欄位，內容須與用戶構想相關——勿留空必填鍵。',
    '改進模式（表單已有內容）：潤飾並補齊空白欄，與已填內容一致；除非用戶要求，否則勿改核心身份。',
    '不得從「本次 prompt 未出現」的來源引入身份、劇情、天氣、職業、地點、時代或風格（禁止 active 故事、Demo 樣本、App 預設世界觀）。',
    '若下方明確附有故事／風格區塊：僅作 continuity；不可覆蓋用戶明確 idea。'
  ]
}

/** @deprecated Use inventFromProvidedSourcesRules — kept as alias for call sites. */
export function antiDefaultIdentityRules(
  locale: 'zh-HK' | 'en' = 'zh-HK'
): string[] {
  return inventFromProvidedSourcesRules(locale)
}
