/**
 * Top 10 global UI languages for InstantDrama Magician.
 * Codes follow BCP-47; labels are native script.
 */

export const UI_LANGUAGES = [
  { id: 'en', nativeLabel: 'English', englishName: 'English', rtl: false },
  {
    id: 'zh-HK',
    nativeLabel: '繁體中文',
    englishName: 'Chinese (Traditional, Hong Kong)',
    rtl: false
  },
  {
    id: 'zh-CN',
    nativeLabel: '简体中文',
    englishName: 'Chinese (Simplified)',
    rtl: false
  },
  { id: 'es', nativeLabel: 'Español', englishName: 'Spanish', rtl: false },
  { id: 'hi', nativeLabel: 'हिन्दी', englishName: 'Hindi', rtl: false },
  { id: 'ar', nativeLabel: 'العربية', englishName: 'Arabic', rtl: true },
  {
    id: 'pt-BR',
    nativeLabel: 'Português',
    englishName: 'Portuguese (Brazil)',
    rtl: false
  },
  { id: 'fr', nativeLabel: 'Français', englishName: 'French', rtl: false },
  { id: 'ja', nativeLabel: '日本語', englishName: 'Japanese', rtl: false },
  { id: 'ru', nativeLabel: 'Русский', englishName: 'Russian', rtl: false }
] as const

export type UiLanguage = (typeof UI_LANGUAGES)[number]['id']

const ID_SET = new Set<string>(UI_LANGUAGES.map((l) => l.id))

export function isUiLanguage(id: string | null | undefined): id is UiLanguage {
  return Boolean(id && ID_SET.has(id))
}

export function coerceUiLanguage(
  id: string | null | undefined,
  fallback: UiLanguage = 'zh-HK'
): UiLanguage {
  if (id && isUiLanguage(id)) return id
  // Common aliases
  const l = (id ?? '').toLowerCase().replace(/_/g, '-')
  if (l === 'zh' || l === 'zh-tw' || l === 'zh-hant' || l === 'zh-hk')
    return 'zh-HK'
  if (l === 'zh-hans' || l.startsWith('zh-cn') || l === 'zh-sg') return 'zh-CN'
  if (l.startsWith('en')) return 'en'
  if (l.startsWith('es')) return 'es'
  if (l.startsWith('hi')) return 'hi'
  if (l.startsWith('ar')) return 'ar'
  if (l.startsWith('pt')) return 'pt-BR'
  if (l.startsWith('fr')) return 'fr'
  if (l.startsWith('ja')) return 'ja'
  if (l.startsWith('ru')) return 'ru'
  return fallback
}

/** localStorage key for web login language (before settings load). */
export const UI_LANGUAGE_STORAGE_KEY = 'idm.uiLanguage'

/**
 * Best UI language from browser / navigator (web). Safe for SSR / Node.
 */
export function detectBrowserUiLanguage(
  fallback: UiLanguage = 'en'
): UiLanguage {
  if (typeof navigator === 'undefined') return fallback
  const candidates: string[] = []
  if (Array.isArray(navigator.languages)) {
    candidates.push(...navigator.languages)
  }
  if (navigator.language) candidates.push(navigator.language)
  for (const c of candidates) {
    const code = coerceUiLanguage(c, fallback)
    // Only accept if coerce actually mapped (not pure fallback unless input empty)
    if (c && isUiLanguage(code)) {
      // Prefer first navigator entry that maps to a known language
      const l = c.toLowerCase().replace(/_/g, '-')
      if (
        isUiLanguage(c) ||
        l.startsWith('zh') ||
        l.startsWith('en') ||
        l.startsWith('es') ||
        l.startsWith('hi') ||
        l.startsWith('ar') ||
        l.startsWith('pt') ||
        l.startsWith('fr') ||
        l.startsWith('ja') ||
        l.startsWith('ru')
      ) {
        return coerceUiLanguage(c, fallback)
      }
    }
  }
  return fallback
}

/** Read persisted web UI language if valid. */
export function readStoredUiLanguage(): UiLanguage | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(UI_LANGUAGE_STORAGE_KEY)
    return isUiLanguage(raw) ? raw : null
  } catch {
    return null
  }
}

export function writeStoredUiLanguage(lang: UiLanguage): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, lang)
  } catch {
    /* ignore quota */
  }
}

export function uiLanguageMeta(id: string | null | undefined) {
  const code = coerceUiLanguage(id)
  return UI_LANGUAGES.find((l) => l.id === code) ?? UI_LANGUAGES[0]
}

export function isRtlLanguage(id: string | null | undefined): boolean {
  return uiLanguageMeta(id).rtl
}

/** Apply document direction for Arabic (and future RTL locales). */
export function applyDocumentDirection(lang: string | null | undefined): void {
  if (typeof document === 'undefined') return
  const rtl = isRtlLanguage(lang)
  document.documentElement.lang = coerceUiLanguage(lang)
  document.documentElement.dir = rtl ? 'rtl' : 'ltr'
}
