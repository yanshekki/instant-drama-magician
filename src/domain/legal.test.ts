import { describe, expect, it } from 'vitest'
import {
  LEGAL_DISCLAIMER_SECTIONS,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_TERMS_SECTIONS,
  LEGAL_VERSION,
  formatLegalAcceptedAt,
  needsLegalAccept
} from './legal'

describe('legal constants', () => {
  it('exposes version and section keys', () => {
    expect(LEGAL_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
    expect(LEGAL_EFFECTIVE_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(LEGAL_DISCLAIMER_SECTIONS).toHaveLength(12)
    expect(LEGAL_TERMS_SECTIONS).toHaveLength(12)
    expect(LEGAL_DISCLAIMER_SECTIONS[0]).toBe('s1')
    expect(LEGAL_TERMS_SECTIONS[11]).toBe('s12')
  })
})

describe('needsLegalAccept', () => {
  it('requires accept when never accepted', () => {
    expect(needsLegalAccept(null)).toBe(true)
    expect(needsLegalAccept(undefined)).toBe(true)
    expect(needsLegalAccept({ legalAcceptedVersion: null })).toBe(true)
    expect(needsLegalAccept({ legalAcceptedVersion: '' })).toBe(true)
  })

  it('requires accept when version mismatches', () => {
    expect(needsLegalAccept({ legalAcceptedVersion: '0.0.1' })).toBe(true)
  })

  it('skips when current version accepted', () => {
    expect(needsLegalAccept({ legalAcceptedVersion: LEGAL_VERSION })).toBe(
      false
    )
  })
})

describe('formatLegalAcceptedAt', () => {
  it('returns empty for nullish', () => {
    expect(formatLegalAcceptedAt(null)).toBe('')
    expect(formatLegalAcceptedAt(undefined)).toBe('')
    expect(formatLegalAcceptedAt('')).toBe('')
  })

  it('formats valid ISO with toLocaleString', () => {
    const iso = '2026-07-19T12:00:00.000Z'
    const out = formatLegalAcceptedAt(iso)
    expect(out.length).toBeGreaterThan(0)
    // locale-dependent string but should not be raw empty
    expect(out).not.toBe('')
  })

  it('returns original for invalid date', () => {
    expect(formatLegalAcceptedAt('not-a-date')).toBe('not-a-date')
  })
})
