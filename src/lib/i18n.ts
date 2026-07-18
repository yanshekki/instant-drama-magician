/**
 * Locale style guide
 * - zh-HK: Hong Kong formal written Traditional Chinese (書面語繁體)
 * - zh-CN: Mainland formal Simplified Chinese
 * - en: American formal written English
 * - Other languages: formal written standard for each locale
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import {
  applyDocumentDirection,
  coerceUiLanguage,
  type UiLanguage
} from '../domain/uiLanguages'

import en from '../locales/en.json'
import zhHK from '../locales/zh-HK.json'
import zhCN from '../locales/zh-CN.json'
import es from '../locales/es.json'
import hi from '../locales/hi.json'
import ar from '../locales/ar.json'
import ptBR from '../locales/pt-BR.json'
import fr from '../locales/fr.json'
import ja from '../locales/ja.json'
import ru from '../locales/ru.json'

const resources = {
  en: { translation: en },
  'zh-HK': { translation: zhHK },
  'zh-CN': { translation: zhCN },
  es: { translation: es },
  hi: { translation: hi },
  ar: { translation: ar },
  'pt-BR': { translation: ptBR },
  fr: { translation: fr },
  ja: { translation: ja },
  ru: { translation: ru }
} as const

void i18n.use(initReactI18next).init({
  resources,
  lng: 'zh-HK',
  fallbackLng: 'en',
  // Exact regional codes (zh-HK, pt-BR). Do NOT use nonExplicitSupportedLngs:
  // with it true, i18next resolves zh-HK → en and all UI stays English.
  supportedLngs: [
    'en',
    'zh-HK',
    'zh-CN',
    'es',
    'hi',
    'ar',
    'pt-BR',
    'fr',
    'ja',
    'ru'
  ],
  nonExplicitSupportedLngs: false,
  load: 'currentOnly',
  interpolation: { escapeValue: false },
  react: { useSuspense: false }
})

i18n.on('languageChanged', (lng) => {
  applyDocumentDirection(lng)
})

// Initial direction
applyDocumentDirection(i18n.language)

export function changeUiLanguage(lang: string): Promise<UiLanguage> {
  const code = coerceUiLanguage(lang)
  if (i18n.language === code && i18n.resolvedLanguage === code) {
    applyDocumentDirection(code)
    return Promise.resolve(code)
  }
  return i18n.changeLanguage(code).then(() => {
    applyDocumentDirection(code)
    return code
  })
}

export default i18n
