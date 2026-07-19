/**
 * World spoken-language catalog for character profile multi-select.
 * Codes are BCP-47 / ISO 639-1 (+ a few regional Sinitic extras for short drama).
 * Display names use Intl.DisplayNames when available (follows UI locale).
 */

/** Complete ISO 639-1 set + common regional variants used in HK/TW/CN drama. */
export const WORLD_LANGUAGE_CODES: readonly string[] = [
  // Regional / macro (listed first for drama UX)
  'yue',
  'zh-Hant',
  'zh-Hans',
  'cmn',
  'nan',
  'hak',
  'wuu',
  'zh',
  // ISO 639-1 (alphabetical)
  'aa',
  'ab',
  'ae',
  'af',
  'ak',
  'am',
  'an',
  'ar',
  'as',
  'av',
  'ay',
  'az',
  'ba',
  'be',
  'bg',
  'bi',
  'bm',
  'bn',
  'bo',
  'br',
  'bs',
  'ca',
  'ce',
  'ch',
  'co',
  'cr',
  'cs',
  'cu',
  'cv',
  'cy',
  'da',
  'de',
  'dv',
  'dz',
  'ee',
  'el',
  'en',
  'eo',
  'es',
  'et',
  'eu',
  'fa',
  'ff',
  'fi',
  'fj',
  'fo',
  'fr',
  'fy',
  'ga',
  'gd',
  'gl',
  'gn',
  'gu',
  'gv',
  'ha',
  'he',
  'hi',
  'ho',
  'hr',
  'ht',
  'hu',
  'hy',
  'hz',
  'ia',
  'id',
  'ie',
  'ig',
  'ii',
  'ik',
  'io',
  'is',
  'it',
  'iu',
  'ja',
  'jv',
  'ka',
  'kg',
  'ki',
  'kj',
  'kk',
  'kl',
  'km',
  'kn',
  'ko',
  'kr',
  'ks',
  'ku',
  'kv',
  'kw',
  'ky',
  'la',
  'lb',
  'lg',
  'li',
  'ln',
  'lo',
  'lt',
  'lu',
  'lv',
  'mg',
  'mh',
  'mi',
  'mk',
  'ml',
  'mn',
  'mr',
  'ms',
  'mt',
  'my',
  'na',
  'nb',
  'nd',
  'ne',
  'ng',
  'nl',
  'nn',
  'no',
  'nr',
  'nv',
  'ny',
  'oc',
  'oj',
  'om',
  'or',
  'os',
  'pa',
  'pi',
  'pl',
  'ps',
  'pt',
  'qu',
  'rm',
  'rn',
  'ro',
  'ru',
  'rw',
  'sa',
  'sc',
  'sd',
  'se',
  'sg',
  'si',
  'sk',
  'sl',
  'sm',
  'sn',
  'so',
  'sq',
  'sr',
  'ss',
  'st',
  'su',
  'sv',
  'sw',
  'ta',
  'te',
  'tg',
  'th',
  'ti',
  'tk',
  'tl',
  'tn',
  'to',
  'tr',
  'ts',
  'tt',
  'tw',
  'ty',
  'ug',
  'uk',
  'ur',
  'uz',
  've',
  'vi',
  'vo',
  'wa',
  'wo',
  'xh',
  'yi',
  'yo',
  'za',
  'zu'
] as const

/** Hand-tuned labels when Intl is missing or for regional codes. */
const FALLBACK_LABELS_EN: Record<string, string> = {
  yue: 'Cantonese (Yue)',
  'zh-Hant': 'Chinese (Traditional)',
  'zh-Hans': 'Chinese (Simplified)',
  cmn: 'Mandarin Chinese',
  nan: 'Hokkien / Southern Min',
  hak: 'Hakka',
  wuu: 'Wu Chinese (Shanghainese etc.)',
  zh: 'Chinese',
  en: 'English',
  ja: 'Japanese',
  ko: 'Korean',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  pt: 'Portuguese',
  ru: 'Russian',
  ar: 'Arabic',
  hi: 'Hindi',
  th: 'Thai',
  vi: 'Vietnamese',
  id: 'Indonesian',
  ms: 'Malay',
  tl: 'Tagalog',
  it: 'Italian',
  nl: 'Dutch',
  pl: 'Polish',
  tr: 'Turkish',
  uk: 'Ukrainian',
  he: 'Hebrew',
  fa: 'Persian',
  bn: 'Bengali',
  ta: 'Tamil',
  te: 'Telugu',
  ur: 'Urdu',
  sw: 'Swahili'
}

const FALLBACK_LABELS_ZH: Record<string, string> = {
  yue: '粵語（廣東話）',
  'zh-Hant': '中文（繁體）',
  'zh-Hans': '中文（簡體）',
  cmn: '普通話／國語',
  nan: '閩南語／台語',
  hak: '客家話',
  wuu: '吳語（上海話等）',
  zh: '中文',
  en: '英語',
  ja: '日語',
  ko: '韓語',
  fr: '法語',
  de: '德語',
  es: '西班牙語',
  pt: '葡萄牙語',
  ru: '俄語',
  ar: '阿拉伯語',
  hi: '印地語',
  th: '泰語',
  vi: '越南語',
  id: '印尼語',
  ms: '馬來語',
  tl: '他加祿語',
  it: '意大利語',
  nl: '荷蘭語',
  pl: '波蘭語',
  tr: '土耳其語',
  uk: '烏克蘭語',
  he: '希伯來語',
  fa: '波斯語',
  bn: '孟加拉語',
  ta: '泰米爾語',
  te: '泰盧固語',
  ur: '烏爾都語',
  sw: '斯瓦希里語'
}

export interface WorldLanguageOption {
  code: string
  label: string
}

function displayLocale(uiLang?: string | null): string {
  const l = (uiLang ?? '').toLowerCase()
  if (l === 'en' || l.startsWith('en-') || l.startsWith('en_')) return 'en'
  return 'zh-Hant'
}

/** Human label for a language code in the UI locale. */
export function languageLabel(
  code: string,
  uiLang?: string | null
): string {
  const loc = displayLocale(uiLang)
  const fallback =
    loc === 'en'
      ? FALLBACK_LABELS_EN[code] ?? code
      : FALLBACK_LABELS_ZH[code] ?? FALLBACK_LABELS_EN[code] ?? code
  try {
    // Intl understands most ISO 639-1; regional extras fall back.
    const dn = new Intl.DisplayNames([loc === 'en' ? 'en' : 'zh-Hant'], {
      type: 'language'
    })
    const name = dn.of(code)
    if (name && name !== code) {
      // Prefer our tuned labels for Sinitic variants
      if (
        code === 'yue' ||
        code === 'zh-Hant' ||
        code === 'zh-Hans' ||
        code === 'cmn' ||
        code === 'nan' ||
        code === 'hak' ||
        code === 'wuu'
      ) {
        return fallback
      }
      return name
    }
  } catch {
    /* ignore */
  }
  return fallback
}

/**
 * Full catalog for multi-select, labels localized to UI language.
 * Regional Sinitic codes stay at the top; rest sorted by label.
 */
export function listWorldLanguages(
  uiLang?: string | null
): WorldLanguageOption[] {
  const pinned = new Set([
    'yue',
    'zh-Hant',
    'zh-Hans',
    'cmn',
    'nan',
    'hak',
    'wuu',
    'zh',
    'en',
    'ja',
    'ko'
  ])
  const all = WORLD_LANGUAGE_CODES.map((code) => ({
    code,
    label: languageLabel(code, uiLang)
  }))
  const head = all.filter((o) => pinned.has(o.code))
  // Keep pinned order as defined in WORLD_LANGUAGE_CODES
  const headOrder = WORLD_LANGUAGE_CODES.filter((c) => pinned.has(c))
  head.sort(
    (a, b) => headOrder.indexOf(a.code) - headOrder.indexOf(b.code)
  )
  const rest = all
    .filter((o) => !pinned.has(o.code))
    .sort((a, b) => a.label.localeCompare(b.label, displayLocale(uiLang)))
  return [...head, ...rest]
}

/** Normalize free-form AI / user input into known codes where possible. */
export function normalizeLanguageCodes(input: unknown): string[] {
  const raw: string[] = []
  if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === 'string' && item.trim()) raw.push(item.trim())
      else if (item != null) raw.push(String(item).trim())
    }
  } else if (typeof input === 'string' && input.trim()) {
    // Comma / slash / Chinese顿号 separated
    raw.push(
      ...input
        .split(/[,，、;/|]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  }
  const known = new Set(WORLD_LANGUAGE_CODES.map((c) => c.toLowerCase()))
  const alias: Record<string, string> = {
    cantonese: 'yue',
    粵語: 'yue',
    广东话: 'yue',
    廣東話: 'yue',
    mandarin: 'cmn',
    普通话: 'cmn',
    普通話: 'cmn',
    国语: 'cmn',
    國語: 'cmn',
    chinese: 'zh',
    中文: 'zh',
    繁体: 'zh-Hant',
    繁體: 'zh-Hant',
    简体: 'zh-Hans',
    簡體: 'zh-Hans',
    english: 'en',
    英语: 'en',
    英語: 'en',
    japanese: 'ja',
    日语: 'ja',
    日語: 'ja',
    日本語: 'ja',
    korean: 'ko',
    韩语: 'ko',
    韓語: 'ko',
    한국어: 'ko',
    hokkien: 'nan',
    闽南语: 'nan',
    閩南語: 'nan',
    台语: 'nan',
    台語: 'nan',
    hakka: 'hak',
    客家话: 'hak',
    客家話: 'hak'
  }
  const out: string[] = []
  const seen = new Set<string>()
  for (const r of raw) {
    const lower = r.toLowerCase()
    let code: string | null =
      alias[lower] ??
      alias[r] ??
      (known.has(lower)
        ? (WORLD_LANGUAGE_CODES.find((c) => c.toLowerCase() === lower) ?? null)
        : null)
    if (!code) {
      // Try direct code match case-insensitive for zh-Hant etc.
      const found = WORLD_LANGUAGE_CODES.find(
        (c) => c.toLowerCase() === lower
      )
      code = found ?? null
    }
    if (code == null) continue
    if (seen.has(code)) continue
    seen.add(code)
    out.push(code)
  }
  return out
}

export function parseSpokenLanguagesJson(
  raw: string | null | undefined
): string[] {
  if (!raw?.trim()) return []
  try {
    return normalizeLanguageCodes(JSON.parse(raw))
  } catch {
    return normalizeLanguageCodes(raw)
  }
}

export function serializeSpokenLanguages(codes: string[]): string | null {
  const n = normalizeLanguageCodes(codes)
  if (n.length === 0) return null
  return JSON.stringify(n)
}

export function formatSpokenLanguagesDisplay(
  codes: string[],
  uiLang?: string | null
): string {
  if (!codes.length) return ''
  return codes.map((c) => languageLabel(c, uiLang)).join('、')
}
