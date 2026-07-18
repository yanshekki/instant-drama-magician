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
  if (l === 'zh' || l === 'zh-tw' || l === 'zh-hant') return 'zh-HK'
  if (l === 'zh-hans' || l.startsWith('zh-cn')) return 'zh-CN'
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
