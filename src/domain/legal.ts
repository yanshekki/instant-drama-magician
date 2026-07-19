/**
 * Legal documents versioning (Disclaimer + Acceptable Use).
 * Bump LEGAL_VERSION when text meaning changes so users re-accept.
 */
import type { AppSettings } from '../types/settings'

/**
 * Semantic version of the in-app legal package.
 * Bump whenever Disclaimer / Acceptable Use text changes meaningfully
 * so users must re-accept (Settings shows this number, not package.json).
 */
export const LEGAL_VERSION = '1.0.0'

/** Effective date shown in UI (ISO date). */
export const LEGAL_EFFECTIVE_DATE = '2026-07-19'

/** Disclaimer section keys under legal.disclaimer.* */
export const LEGAL_DISCLAIMER_SECTIONS = [
  's1',
  's2',
  's3',
  's4',
  's5',
  's6',
  's7',
  's8',
  's9',
  's10',
  's11',
  's12'
] as const

/** Terms / code-of-conduct section keys under legal.terms.* */
export const LEGAL_TERMS_SECTIONS = [
  's1',
  's2',
  's3',
  's4',
  's5',
  's6',
  's7',
  's8',
  's9',
  's10',
  's11',
  's12'
] as const

export type LegalDocKind = 'disclaimer' | 'terms'

export function needsLegalAccept(
  settings: Pick<AppSettings, 'legalAcceptedVersion'> | null | undefined
): boolean {
  if (!settings) return true
  const v = settings.legalAcceptedVersion
  return !v || v !== LEGAL_VERSION
}

export function formatLegalAcceptedAt(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString()
  } catch {
    return iso
  }
}
