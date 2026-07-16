import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhHK from '../locales/zh-HK.json'
import en from '../locales/en.json'

void i18n.use(initReactI18next).init({
  resources: {
    'zh-HK': { translation: zhHK },
    en: { translation: en }
  },
  lng: 'zh-HK',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  react: { useSuspense: false }
})

export default i18n
