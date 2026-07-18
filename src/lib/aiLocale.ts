/**
 * Resolve AI generation locale from the app UI language.
 * LLM prompts currently use Traditional Chinese (HK formal) or English.
 * Other UI languages map to the closest writing system for generation.
 */
export type AiLocale = 'zh-HK' | 'en'

export function getAiLocale(lang?: string | null): AiLocale {
  const l = (lang ?? '').toLowerCase().replace(/_/g, '-')
  if (!l) return 'zh-HK'
  // Chinese family → formal written Chinese (zh-HK prompts)
  if (l === 'zh' || l.startsWith('zh-')) return 'zh-HK'
  // Everything else → English prompts (most LLM models are strongest here)
  if (
    l === 'en' ||
    l.startsWith('en-') ||
    l.startsWith('es') ||
    l.startsWith('hi') ||
    l.startsWith('ar') ||
    l.startsWith('pt') ||
    l.startsWith('fr') ||
    l.startsWith('ja') ||
    l.startsWith('ru') ||
    l.startsWith('de') ||
    l.startsWith('ko')
  ) {
    // ja could use Japanese prompts later; for now English is safer for mixed pipeline
    if (l.startsWith('ja')) return 'en'
    return 'en'
  }
  return 'zh-HK'
}
