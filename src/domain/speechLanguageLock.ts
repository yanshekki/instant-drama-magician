/**
 * Hard lock for audible speech / lip-sync language.
 * Character spokenLanguages is source of truth; empty → UI locale default.
 */
import { languageLabel, normalizeLanguageCodes } from './worldLanguages'
import { PromptCatalog } from '../prompts/PromptCatalog'

export type SpeechLockCharacter = {
  name?: string | null
  spokenLanguages?: string | string[] | null
}

/** Default spoken-language code from UI locale. */
export function defaultSpeechCodeFromUi(uiLocale?: string | null): string {
  const l = (uiLocale || '').toLowerCase().replace(/_/g, '-')
  if (l === 'yue' || l.startsWith('zh-hk') || l.startsWith('zh-tw')) return 'yue'
  if (
    l === 'cmn' ||
    l.startsWith('zh-cn') ||
    l.startsWith('zh-hans') ||
    l === 'zh'
  ) {
    return 'cmn'
  }
  if (l.startsWith('ja')) return 'ja'
  if (l.startsWith('ko')) return 'ko'
  return 'en'
}

/** Parse profile JSON string / array / free text into known codes. */
export function parseSpokenLanguageInput(
  raw: string | string[] | null | undefined
): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) return normalizeLanguageCodes(raw)
  const s = String(raw).trim()
  if (!s) return []
  try {
    const parsed = JSON.parse(s) as unknown
    if (Array.isArray(parsed)) return normalizeLanguageCodes(parsed)
  } catch {
    /* not JSON */
  }
  return normalizeLanguageCodes(s)
}

/** First valid code, else UI default. */
export function primarySpeechCode(
  codes: string[] | null | undefined,
  uiLocale?: string | null
): string {
  const list = (codes ?? []).map((c) => c.trim()).filter(Boolean)
  if (list[0]) return list[0]
  return defaultSpeechCodeFromUi(uiLocale)
}

export function speechLanguageDisplayName(
  code: string,
  uiLocale?: string | null
): string {
  const label = languageLabel(code, uiLocale || 'zh-HK')
  if (code === 'yue' && !/cantonese|粵語|广东话|廣東話/i.test(label)) {
    return `${label} / Cantonese`
  }
  return label
}

function forbiddenExamples(
  allowed: string[],
  uiLocale?: string | null
): string {
  const set = new Set(allowed)
  const extras: string[] = []
  if (!set.has('cmn') && !set.has('zh-Hans') && !set.has('zh')) {
    extras.push(speechLanguageDisplayName('cmn', uiLocale))
  }
  if (!set.has('en')) extras.push(speechLanguageDisplayName('en', uiLocale))
  if (!set.has('yue') && extras.length < 2) {
    extras.push(speechLanguageDisplayName('yue', uiLocale))
  }
  return extras.slice(0, 2).join(' / ')
}

/** One lock paragraph for a single speaker. */
export function speechLanguageLockLine(opts: {
  name?: string | null
  codes?: string[] | null
  uiLocale?: string | null
  locale?: string | null
}): string {
  const loc = opts.locale || opts.uiLocale || 'zh-HK'
  const codes = opts.codes?.length
    ? opts.codes
    : [defaultSpeechCodeFromUi(opts.uiLocale || loc)]
  const primary = primarySpeechCode(codes, opts.uiLocale || loc)
  const extras = codes.filter((c) => c !== primary)
  const primaryName = speechLanguageDisplayName(primary, loc)
  const who = (opts.name || '').trim()
  const forbid = forbiddenExamples([primary, ...extras], loc)
  const extraNames = extras
    .map((c) => `${speechLanguageDisplayName(c, loc)} (${c})`)
    .join('、')
  const vars = { who, primaryName, primary, extras: extraNames, forbid }
  if (extras.length) {
    return PromptCatalog.t(
      loc,
      who ? 'speechLock.namedMulti' : 'speechLock.unnamedMulti',
      vars
    )
  }
  return PromptCatalog.t(loc, who ? 'speechLock.named' : 'speechLock.unnamed', vars)
}

export function speechLanguageLockLines(opts: {
  characters?: SpeechLockCharacter[] | null
  uiLocale?: string | null
  locale?: string | null
}): string[] {
  const loc = opts.locale || opts.uiLocale || 'zh-HK'
  const list = (opts.characters ?? []).filter(Boolean)
  const lines: string[] = []
  for (const c of list) {
    const codes = parseSpokenLanguageInput(c.spokenLanguages)
    if (!codes.length) continue
    lines.push(
      speechLanguageLockLine({
        name: c.name,
        codes,
        uiLocale: opts.uiLocale || loc,
        locale: loc
      })
    )
  }
  return lines
}

export function buildSpeechLanguageLockText(opts: {
  characters?: SpeechLockCharacter[] | null
  uiLocale?: string | null
  locale?: string | null
}): string {
  return speechLanguageLockLines(opts).join('\n')
}

export function mergeSpeechLockIntoHardRules(
  existing: string | null | undefined,
  lock: string | null | undefined
): string | null {
  const lockText = (lock || '').trim()
  if (!lockText) return existing?.trim() || null
  const base = (existing || '').trim()
  if (!base) return lockText
  if (base.includes(lockText)) return base
  const missing = lockText
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l && !base.includes(l))
  if (missing.length === 0) return base
  return `${base}\n${missing.join('\n')}`
}
