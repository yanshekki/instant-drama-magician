import { PromptCatalog } from '../prompts'

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
  locale: string = 'zh-HK'
): string[] {
  return [
    PromptCatalog.t(locale, 'invent.sources'),
    PromptCatalog.t(locale, 'invent.create'),
    PromptCatalog.t(locale, 'invent.improve'),
    PromptCatalog.t(locale, 'invent.noImport'),
    PromptCatalog.t(locale, 'invent.storyBlock')
  ]
}

/** @deprecated Use inventFromProvidedSourcesRules — kept as alias for call sites. */
export function antiDefaultIdentityRules(locale: string = 'zh-HK'): string[] {
  return inventFromProvidedSourcesRules(locale)
}
