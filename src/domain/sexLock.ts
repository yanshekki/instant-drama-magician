/**
 * Sex lock for image prompts. Models treat bun / oval-face / pale / slim / robe
 * as female unless male/female is front-loaded and sealed in HARD RULES.
 */
import { resolvePromptContext } from '../prompts'

export type BinarySex = 'male' | 'female'

export function classifySex(raw?: string | null): BinarySex | null {
  const s = (raw ?? '').trim()
  if (!s) return null
  const n = s.toLowerCase().replace(/\s+/g, '')
  if (
    /^(m|male|man|boy|masculine|男|男性|男人|男仔|男生|男子|雄性|公)$/i.test(n) ||
    /男性|男人|男仔|男生|男子/.test(s)
  ) {
    return 'male'
  }
  if (
    /^(f|female|woman|girl|feminine|女|女性|女人|女仔|女生|女子|雌性|母)$/i.test(
      n
    ) ||
    /女性|女人|女仔|女生|女子/.test(s)
  ) {
    return 'female'
  }
  return null
}

export function sexPromptLock(
  raw?: string | null,
  locale?: string | null
): string {
  const sex = classifySex(raw)
  if (!sex) return ''
  const pack = resolvePromptContext(locale).pack
  return sex === 'male' ? pack.sexLockMale : pack.sexLockFemale
}

export function mergeSexIntoHardRules(
  hardRules: string | null | undefined,
  rawGender?: string | null,
  name?: string | null,
  locale?: string | null
): string | null {
  const sex = classifySex(rawGender)
  if (!sex) return hardRules?.trim() || null
  const ctx = resolvePromptContext(locale)
  const { must, mustNot } = ctx.tags
  const who = (name ?? '').trim() || (sex === 'male' ? 'male' : 'female')
  const lock = sex === 'male' ? ctx.pack.sexLockMale : ctx.pack.sexLockFemale
  const forbid =
    sex === 'male' ? ctx.pack.sexForbidMale : ctx.pack.sexForbidFemale
  const extra = [
    `${must} ${who}: ${lock}`,
    `${mustNot} ${forbid}`
  ].join('\n')
  const base = (hardRules ?? '').trim()
  if (!base) return extra
  if (base.includes(lock.slice(0, 12))) return base
  return `${base}\n${extra}`
}
